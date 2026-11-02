#define UNICODE
#define _UNICODE
#include <windows.h>
#include <shellapi.h>
#include <shlwapi.h>
#include <stdio.h>
#include <wchar.h>

// Compiled with: x86_64-w64-mingw32-gcc -mwindows -O2 launcher.c -o FixedAssetsManager.exe -lshlwapi -lshell32

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    wchar_t exeDir[MAX_PATH];
    GetModuleFileNameW(NULL, exeDir, MAX_PATH);
    PathRemoveFileSpecW(exeDir);

    wchar_t htmlPath[MAX_PATH];
    wsprintfW(htmlPath, L"%s\\index.html", exeDir);

    wchar_t appParam[MAX_PATH * 2];
    wchar_t targetUrl[MAX_PATH * 2];

    if (GetFileAttributesW(htmlPath) != INVALID_FILE_ATTRIBUTES) {
        // Offline local mode: index.html is present in the same folder
        wsprintfW(targetUrl, L"file:///%s", htmlPath);
        wsprintfW(appParam, L"--app=\"%s\"", targetUrl);
    } else {
        // Direct online app window mode
        wcscpy(targetUrl, L"https://ais-pre-czuygllmulq2dkfssk4mo5-985372917081.europe-west2.run.app");
        wsprintfW(appParam, L"--app=\"%s\"", targetUrl);
    }

    const wchar_t* browsers[] = {
        L"msedge.exe",
        L"chrome.exe",
        L"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        L"C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        L"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        L"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        L"C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe"
    };

    int launched = 0;
    for (int i = 0; i < sizeof(browsers)/sizeof(browsers[0]); i++) {
        HINSTANCE res = ShellExecuteW(NULL, L"open", browsers[i], appParam, NULL, SW_SHOWNORMAL);
        if ((INT_PTR)res > 32) {
            launched = 1;
            break;
        }
    }

    // Fallback: Open with default system browser if app-mode command didn't start
    if (!launched) {
        ShellExecuteW(NULL, L"open", targetUrl, NULL, NULL, SW_SHOWNORMAL);
    }

    return 0;
}
