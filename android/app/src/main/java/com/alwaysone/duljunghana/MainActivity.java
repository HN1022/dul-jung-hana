package com.alwaysone.duljunghana;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 뒤로가기: 게임 안에서 연 화면(순위표·상점, 게임 → 시작 화면)을 먼저 닫는다.
        // 게임(index.html 의 Nav)이 화면을 열 때마다 WebView 기록을 한 칸 쌓으므로 goBack 으로 하나씩 닫힌다.
        // 더 닫을 게 없을 때(시작 화면)만 앱을 닫는다. 기본 동작은 바로 앱 종료라서 이게 필요했다.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView wv = getBridge() != null ? getBridge().getWebView() : null;
                if (wv != null && wv.canGoBack()) {
                    wv.goBack();
                } else {
                    finish();
                }
            }
        });
    }
}
