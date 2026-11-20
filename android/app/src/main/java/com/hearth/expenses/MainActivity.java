package com.hearth.expenses;

import android.content.pm.PackageManager;
import android.os.Bundle;
import androidx.annotation.NonNull;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private HearthNativeSpeech speechBridge;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (bridge != null && bridge.getWebView() != null) {
            speechBridge = new HearthNativeSpeech(this, bridge.getWebView());
            bridge.getWebView().addJavascriptInterface(speechBridge, "HearthNativeSpeech");
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == HearthNativeSpeech.REQUEST_MIC_CODE && speechBridge != null) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                speechBridge.onPermissionGranted();
            } else {
                speechBridge.onPermissionDenied();
            }
        }
    }
}
