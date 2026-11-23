package com.hearth.expenses;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import org.json.JSONObject;

public class HearthNativeSpeech {
    public static final int REQUEST_MIC_CODE = 4101;
    private final Activity activity;
    private final WebView webView;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private SpeechRecognizer speechRecognizer;
    private String pendingLanguage = "en-IN";
    private volatile boolean isAborting = false;

    public HearthNativeSpeech(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    @JavascriptInterface
    public boolean isAvailable() {
        return SpeechRecognizer.isRecognitionAvailable(activity);
    }

    @JavascriptInterface
    public void startListening(String language) {
        this.pendingLanguage = (language != null && !language.trim().isEmpty()) ? language : "en-IN";
        this.isAborting = false;
        mainHandler.post(() -> {
            if (ContextCompat.checkSelfPermission(activity, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(activity, new String[]{Manifest.permission.RECORD_AUDIO}, REQUEST_MIC_CODE);
                return;
            }
            startRecognizerInternal();
        });
    }

    public void onPermissionGranted() {
        mainHandler.post(this::startRecognizerInternal);
    }

    public void onPermissionDenied() {
        sendJsEvent("window.__hearthSpeechOnError && window.__hearthSpeechOnError('not-allowed');");
    }

    private void startRecognizerInternal() {
        destroyRecognizer();
        isAborting = false;
        try {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(activity);
            if (speechRecognizer == null) {
                sendJsEvent("window.__hearthSpeechOnError && window.__hearthSpeechOnError('audio-capture');");
                return;
            }

            speechRecognizer.setRecognitionListener(new RecognitionListener() {
                @Override
                public void onReadyForSpeech(Bundle params) {
                    sendJsEvent("window.__hearthSpeechOnReady && window.__hearthSpeechOnReady();");
                }

                @Override
                public void onBeginningOfSpeech() {
                    sendJsEvent("window.__hearthSpeechOnStart && window.__hearthSpeechOnStart();");
                }

                @Override
                public void onRmsChanged(float rmsdB) {}

                @Override
                public void onBufferReceived(byte[] buffer) {}

                @Override
                public void onEndOfSpeech() {
                    sendJsEvent("window.__hearthSpeechOnEndOfSpeech && window.__hearthSpeechOnEndOfSpeech();");
                }

                @Override
                public void onError(int error) {
                    if (isAborting) {
                        sendJsEvent("window.__hearthSpeechOnError && window.__hearthSpeechOnError('aborted');");
                        return;
                    }

                    String errName = "error";
                    switch (error) {
                        case SpeechRecognizer.ERROR_AUDIO:
                            errName = "audio-capture";
                            break;
                        case SpeechRecognizer.ERROR_CLIENT:
                        case SpeechRecognizer.ERROR_NO_MATCH:
                        case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                            errName = "no-speech";
                            break;
                        case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                            errName = "not-allowed";
                            break;
                        case SpeechRecognizer.ERROR_NETWORK:
                        case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                        case SpeechRecognizer.ERROR_SERVER:
                            errName = "network";
                            break;
                        case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                            errName = "busy";
                            break;
                        default:
                            errName = "error";
                            break;
                    }
                    sendJsEvent("window.__hearthSpeechOnError && window.__hearthSpeechOnError(" + JSONObject.quote(errName) + ");");
                }

                @Override
                public void onResults(Bundle results) {
                    ArrayList<String> matches = results != null ? results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) : null;
                    if (matches != null && !matches.isEmpty()) {
                        String text = matches.get(0);
                        sendJsEvent("window.__hearthSpeechOnResults && window.__hearthSpeechOnResults(" + JSONObject.quote(text) + ");");
                    } else {
                        sendJsEvent("window.__hearthSpeechOnError && window.__hearthSpeechOnError('no-speech');");
                    }
                }

                @Override
                public void onPartialResults(Bundle partialResults) {
                    ArrayList<String> matches = partialResults != null ? partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) : null;
                    if (matches != null && !matches.isEmpty()) {
                        String text = matches.get(0);
                        sendJsEvent("window.__hearthSpeechOnPartial && window.__hearthSpeechOnPartial(" + JSONObject.quote(text) + ");");
                    }
                }

                @Override
                public void onEvent(int eventType, Bundle params) {}
            });

            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, pendingLanguage);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, pendingLanguage);
            intent.putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, pendingLanguage);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);

            speechRecognizer.startListening(intent);
        } catch (Exception e) {
            sendJsEvent("window.__hearthSpeechOnError && window.__hearthSpeechOnError('error');");
        }
    }

    @JavascriptInterface
    public void stopListening() {
        mainHandler.post(() -> {
            if (speechRecognizer != null) {
                try {
                    speechRecognizer.stopListening();
                } catch (Exception ignored) {}
            }
        });
    }

    @JavascriptInterface
    public void abort() {
        isAborting = true;
        mainHandler.post(this::destroyRecognizer);
    }

    @JavascriptInterface
    public void exportCsv(String filename, String csvContent) {
        mainHandler.post(() -> {
            try {
                File exportDir = new File(activity.getCacheDir(), "exports");
                if (!exportDir.exists()) {
                    exportDir.mkdirs();
                }
                String safeName = (filename != null && !filename.trim().isEmpty()) ? filename : "hearth-expenses.csv";
                if (!safeName.toLowerCase().endsWith(".csv")) {
                    safeName += ".csv";
                }
                File file = new File(exportDir, safeName);
                try (FileOutputStream fos = new FileOutputStream(file)) {
                    fos.write(csvContent.getBytes(StandardCharsets.UTF_8));
                }

                Uri contentUri = FileProvider.getUriForFile(
                    activity,
                    activity.getPackageName() + ".fileprovider",
                    file
                );

                Intent shareIntent = new Intent(Intent.ACTION_SEND);
                shareIntent.setType("text/csv");
                shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                shareIntent.putExtra(Intent.EXTRA_SUBJECT, safeName);
                shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                activity.startActivity(Intent.createChooser(shareIntent, "Save or Share CSV"));
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    private void destroyRecognizer() {
        if (speechRecognizer != null) {
            try {
                speechRecognizer.cancel();
                speechRecognizer.destroy();
            } catch (Exception ignored) {}
            speechRecognizer = null;
        }
    }

    private void sendJsEvent(String js) {
        mainHandler.post(() -> {
            if (webView != null) {
                webView.evaluateJavascript(js, null);
            }
        });
    }
}
