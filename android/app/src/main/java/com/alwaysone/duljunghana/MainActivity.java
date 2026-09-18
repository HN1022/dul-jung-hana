package com.alwaysone.duljunghana;

import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import java.security.MessageDigest;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 뒤로가기: 게임 안에서 연 화면(순위표·상점, 게임 → 시작 화면)을 먼저 닫는다.
        // 게임(index.html 의 Nav)이 화면을 열 때마다 WebView 기록을 한 칸 쌓으므로 goBack 으로 하나씩 닫힌다.
        // 더 닫을 게 없을 때(시작 화면)만 앱을 닫는다. 기본 동작은 바로 앱 종료라서 이게 필요했다.
        // 구글 로그인 문제를 찾기 위한 정보: 이 앱에 실제로 서명된 인증서의 SHA-1 (키 교체 기록 포함).
        // 화면에서 window.AppInfo.signingSha1() 로 읽는다. 구글 클라우드에 이 값이 등록돼 있어야 로그인이 된다.
        WebView web = getBridge() != null ? getBridge().getWebView() : null;
        if (web != null) web.addJavascriptInterface(new AppInfo(), "AppInfo");

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

    private class AppInfo {
        @JavascriptInterface
        public String signingSha1() {
            try {
                Signature[] sigs;
                PackageManager pm = getPackageManager();
                if (Build.VERSION.SDK_INT >= 28) {
                    PackageInfo pi = pm.getPackageInfo(getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
                    sigs = pi.signingInfo.hasMultipleSigners()
                        ? pi.signingInfo.getApkContentsSigners()
                        : pi.signingInfo.getSigningCertificateHistory();
                } else {
                    sigs = pm.getPackageInfo(getPackageName(), PackageManager.GET_SIGNATURES).signatures;
                }
                StringBuilder out = new StringBuilder();
                for (Signature sig : sigs) {
                    byte[] d = MessageDigest.getInstance("SHA-1").digest(sig.toByteArray());
                    if (out.length() > 0) out.append(" / ");
                    for (int i = 0; i < d.length; i++) {
                        if (i > 0) out.append(':');
                        out.append(String.format("%02X", d[i]));
                    }
                }
                return out.toString();
            } catch (Exception e) {
                return "?";
            }
        }
    }
}
