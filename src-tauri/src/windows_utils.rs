use std::ffi::c_void;
use winapi::um::winuser::{GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId};
use winapi::um::processthreadsapi::OpenProcess;
use winapi::um::psapi::GetModuleBaseNameW;
use winapi::um::winnt::PROCESS_QUERY_INFORMATION;
use winapi::um::winnt::PROCESS_VM_READ;

pub fn get_foreground_process_name() -> String {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return "Unknown".to_string();
        }

        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);

        let handle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, 0, pid);
        if handle.is_null() {
            return "Unknown".to_string();
        }

        let mut name: [u16; 1024] = [0; 1024];
        let len = GetModuleBaseNameW(handle, std::ptr::null_mut(), name.as_mut_ptr(), name.len() as u32);
        
        if len > 0 {
            let name = String::from_utf16_lossy(&name[..len as usize]);
            let name = name.trim_end_matches(".exe");
            return name.to_string();
        }
        
        "Unknown".to_string()
    }
}

pub fn get_window_title() -> String {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return "Unknown".to_string();
        }

        let len = GetWindowTextLengthW(hwnd);
        if len == 0 {
            return "Unknown".to_string();
        }

        let mut title: Vec<u16> = Vec::with_capacity((len + 1) as usize);
        title.set_len((len + 1) as usize);
        GetWindowTextW(hwnd, title.as_mut_ptr(), title.len() as i32);

        String::from_utf16_lossy(&title[..len as usize])
    }
}
