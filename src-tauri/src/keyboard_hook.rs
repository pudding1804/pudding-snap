use std::sync::atomic::{AtomicIsize, Ordering};
use winapi::um::winuser::{
    CallNextHookEx, GetMessageW, SetWindowsHookExW, UnhookWindowsHookEx,
    WH_KEYBOARD_LL, MSG, WM_KEYDOWN, WM_SYSKEYDOWN,
};
use winapi::shared::minwindef::{LPARAM, LRESULT, WPARAM};

const VK_SNAPSHOT: i32 = 0x2C;

static HOOK_HANDLE: AtomicIsize = AtomicIsize::new(0);
static mut HOOK_CALLBACK: Option<Box<dyn Fn() + Send>> = None;

unsafe extern "system" fn keyboard_hook_callback(
    n_code: i32,
    w_param: WPARAM,
    l_param: LPARAM,
) -> LRESULT {
    if n_code >= 0 {
        let msg = w_param as u32;
        if msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN {
            let kb_struct = &*(l_param as *const winapi::um::winuser::KBDLLHOOKSTRUCT);
            if kb_struct.vkCode == VK_SNAPSHOT as u32 {
                println!("[Hook] 检测到 PrintScreen，阻止传播并触发截图");
                if let Some(ref callback) = HOOK_CALLBACK {
                    callback();
                }
                return 1;
            }
        }
    }
    CallNextHookEx(std::ptr::null_mut(), n_code, w_param, l_param)
}

pub fn start_keyboard_hook<F>(callback: F)
where
    F: Fn() + Send + 'static,
{
    std::thread::spawn(move || {
        println!("[Hook] 启动 WH_KEYBOARD_LL 钩子线程");

        unsafe {
            HOOK_CALLBACK = Some(Box::new(callback));

            let hook = SetWindowsHookExW(
                WH_KEYBOARD_LL,
                Some(keyboard_hook_callback),
                std::ptr::null_mut(),
                0,
            );

            if hook.is_null() {
                eprintln!("[Hook] 安装键盘钩子失败");
                HOOK_CALLBACK = None;
                return;
            }

            HOOK_HANDLE.store(hook as isize, Ordering::SeqCst);
            println!("[Hook] 键盘钩子安装成功");

            let mut msg: MSG = std::mem::zeroed();
            while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {}

            let current_hook = HOOK_HANDLE.swap(0, Ordering::SeqCst);
            if current_hook != 0 {
                UnhookWindowsHookEx(current_hook as *mut _);
            }
            HOOK_CALLBACK = None;
            println!("[Hook] 键盘钩子线程退出");
        }
    });
}

pub fn stop_keyboard_hook() {
    let hook = HOOK_HANDLE.swap(0, Ordering::SeqCst);
    if hook != 0 {
        unsafe {
            UnhookWindowsHookEx(hook as *mut _);
        }
        println!("[Hook] 键盘钩子已卸载");
    }
}
