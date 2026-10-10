package com.alwaysone.blockdilemma;

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

        // 시스템 글꼴 크기를 아주 크게 해 둔 폰에서 화면이 무너졌다(2026-10-10, 어머니 폰).
        // WebView 는 그 배율을 글자에 그대로 곱한다 — 안내 문구가 네 줄이 되고, 보드가 쪼그라들고,
        // 보관 칸이 광고 밑으로 잘려 나갔다. 게임판은 글자가 아니라 칸 크기로 돌아가는 화면이라
        // 배율을 끝까지 따라가면 못 쓰게 된다.
        // 그렇다고 무시하면 크게 보려는 사람에게 못 할 짓이라, **상한만 둔다**. 1.2배까지는 따라가고
        // 그 위로는 더 키우지 않는다. 숫자 하나만 고치면 조절된다.
        if (web != null) {
            float wanted = getResources().getConfiguration().fontScale;   // 1.0 = 기본
            float capped = Math.min(wanted, 1.2f);
            if (wanted > 0f) web.getSettings().setTextZoom(Math.round(capped / wanted * 100f));
        }

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
