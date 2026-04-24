use std::sync::{Arc, Mutex};
use winapi::um::winuser::{
    CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW, GetMessageW,
    GetRawInputData, PostQuitMessage, RegisterClassW, RegisterRawInputDevices,
    SetWindowLongPtrW, GetWindowLongPtrW, TranslateMessage,
    RID_INPUT, RIDEV_INPUTSINK, RAWINPUTDEVICE, MSG, WNDCLASSW,
    WM_INPUT, WM_DESTROY, WM_NCCREATE, WS_EX_TOOLWINDOW,
    GWLP_USERDATA,
};
use winapi::shared::minwindef::{LPARAM, LRESULT, UINT, WPARAM};
use winapi::shared::windef::HWND;

const VK_SNAPSHOT: i32 = 0x2C;
const VK_F12: i32 = 0x7B;
const RIM_TYPEKEYBOARD: u32 = 1;
const WM_KEYDOWN: u32 = 0x0100;
const WM_SYSKEYDOWN: u32 = 0x0106;

#[derive(Debug, Clone, Copy)]
pub enum RawHotkeyEvent {
    PrintScreen,
    F12,
}

struct SharedState {
    callback: Box<dyn Fn(RawHotkeyEvent) + Send>,
}

#[inline]
fn read_u16_le(data: &[u8], offset: usize) -> u16 {
    u16::from_le_bytes([data[offset], data[offset + 1]])
}

#[inline]
fn read_u32_le(data: &[u8], offset: usize) -> u32 {
    u32::from_le_bytes([data[offset], data[offset + 1], data[offset + 2], data[offset + 3]])
}

unsafe extern "system" fn raw_input_wndproc(
    hwnd: HWND,
    msg: UINT,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    match msg {
        WM_NCCREATE => {
            let cs = &*(lparam as *const winapi::um::winuser::CREATESTRUCTW);
            let shared_ptr = cs.lpCreateParams as *mut Arc<Mutex<SharedState>>;
            SetWindowLongPtrW(hwnd, GWLP_USERDATA, shared_ptr as isize);
            DefWindowProcW(hwnd, msg, wparam, lparam)
        }
        WM_INPUT => {
            let shared_ptr = GetWindowLongPtrW(hwnd, GWLP_USERDATA) as *mut Arc<Mutex<SharedState>>;
            if !shared_ptr.is_null() {
                let shared = &*shared_ptr;

                let mut size: u32 = 0;
                GetRawInputData(
                    lparam as _,
                    RID_INPUT,
                    std::ptr::null_mut(),
                    &mut size,
                    std::mem::size_of::<winapi::um::winuser::RAWINPUTHEADER>() as u32,
                );

                if size > 0 {
                    let mut buffer: Vec<u8> = vec![0u8; size as usize];
                    let copied = GetRawInputData(
                        lparam as _,
                        RID_INPUT,
                        buffer.as_mut_ptr() as _,
                        &mut size,
                        std::mem::size_of::<winapi::um::winuser::RAWINPUTHEADER>() as u32,
                    );

                    if copied > 0 {
                        let header_size = std::mem::size_of::<winapi::um::winuser::RAWINPUTHEADER>();
                        let dw_type = read_u32_le(&buffer, 0);

                        if dw_type == RIM_TYPEKEYBOARD && buffer.len() >= header_size + 16 {
                            let kb_offset = header_size;
                            let v_key = read_u16_le(&buffer, kb_offset + 6);
                            let message = read_u32_le(&buffer, kb_offset + 8);

                            if message == WM_KEYDOWN as u32
                                || message == WM_SYSKEYDOWN as u32
                            {
                                let event = match v_key as i32 {
                                    VK_SNAPSHOT => Some(RawHotkeyEvent::PrintScreen),
                                    VK_F12 => Some(RawHotkeyEvent::F12),
                                    _ => None,
                                };

                                if let Some(hotkey_event) = event {
                                    println!("[RawInput] 检测到按键: {:?}", hotkey_event);
                                    let shared_lock = shared.lock().unwrap();
                                    (shared_lock.callback)(hotkey_event);
                                }
                            }
                        }
                    }
                }
            }
            DefWindowProcW(hwnd, msg, wparam, lparam)
        }
        WM_DESTROY => {
            let shared_ptr = GetWindowLongPtrW(hwnd, GWLP_USERDATA) as *mut Arc<Mutex<SharedState>>;
            if !shared_ptr.is_null() {
                drop(Box::from_raw(shared_ptr));
                SetWindowLongPtrW(hwnd, GWLP_USERDATA, 0);
            }
            PostQuitMessage(0);
            0
        }
        _ => DefWindowProcW(hwnd, msg, wparam, lparam),
    }
}

pub fn start_raw_input_listener<F>(callback: F)
where
    F: Fn(RawHotkeyEvent) + Send + 'static,
{
    std::thread::spawn(move || {
        println!("[RawInput] 启动 Raw Input 监听线程");

        let shared = Arc::new(Mutex::new(SharedState {
            callback: Box::new(callback),
        }));

        let class_name: Vec<u16> = "PuddingSnapRawInput\0".encode_utf16().collect();

        let wnd_class = WNDCLASSW {
            style: 0,
            lpfnWndProc: Some(raw_input_wndproc),
            hInstance: std::ptr::null_mut(),
            lpszClassName: class_name.as_ptr(),
            cbClsExtra: 0,
            cbWndExtra: 0,
            hIcon: std::ptr::null_mut(),
            hCursor: std::ptr::null_mut(),
            hbrBackground: std::ptr::null_mut(),
            lpszMenuName: std::ptr::null(),
        };

        unsafe {
            if RegisterClassW(&wnd_class) == 0 {
                eprintln!("[RawInput] 注册窗口类失败");
                return;
            }

            let shared_boxed = Box::new(shared);
            let shared_raw = Box::into_raw(shared_boxed);

            let hwnd = CreateWindowExW(
                WS_EX_TOOLWINDOW,
                class_name.as_ptr(),
                std::ptr::null(),
                0,
                0,
                0,
                0,
                0,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                shared_raw as *mut _,
            );

            if hwnd.is_null() {
                eprintln!("[RawInput] 创建隐藏窗口失败");
                let _ = Box::from_raw(shared_raw);
                return;
            }

            println!("[RawInput] 隐藏窗口创建成功");

            let rid = RAWINPUTDEVICE {
                usUsagePage: 0x01,
                usUsage: 0x06,
                dwFlags: RIDEV_INPUTSINK,
                hwndTarget: hwnd,
            };

            if RegisterRawInputDevices(
                &rid,
                1,
                std::mem::size_of::<RAWINPUTDEVICE>() as u32,
            ) == 0
            {
                eprintln!("[RawInput] 注册 Raw Input 设备失败");
                DestroyWindow(hwnd);
                return;
            }

            println!("[RawInput] Raw Input 设备注册成功 (RIDEV_INPUTSINK)");

            let mut msg: MSG = std::mem::zeroed();
            while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
                TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }

            println!("[RawInput] 监听线程退出");
        }
    });
}
