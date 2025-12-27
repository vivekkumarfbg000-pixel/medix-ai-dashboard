package com.pharmaassist.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.DownloadManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.URLUtil;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.Date;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupWebView();
    }

    @Override
    public void onStart() {
        super.onStart();
        setupWebView();
    }

    private void setupWebView() {
        try {
            if (this.getBridge() != null && this.getBridge().getWebView() != null) {
                WebView webView = this.getBridge().getWebView();
                // Add interface for Blob handling
                webView.addJavascriptInterface(new WebAppInterface(this), "Android");
                
                webView.setDownloadListener(new DownloadListener() {
                    @Override
                    public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
                        try {
                            if (url.startsWith("blob:")) {
                                // Handle Blob URL by injecting JS
                                String js = "javascript:(function(){" +
                                        "var xhr = new XMLHttpRequest();" +
                                        "xhr.open('GET', '" + url + "', true);" +
                                        "xhr.responseType = 'blob';" +
                                        "xhr.onload = function(){" +
                                        "    if(this.status == 200){" +
                                        "        var blob = this.response;" +
                                        "        var reader = new FileReader();" +
                                        "        reader.readAsDataURL(blob);" +
                                        "        reader.onloadend = function(){" +
                                        "            var base64data = reader.result;" +
                                        "            Android.downloadBlob(base64data, '" + mimetype + "');" +
                                        "        }" +
                                        "    }" +
                                        "};" +
                                        "xhr.send();" +
                                        "})()";
                                webView.loadUrl(js);
                            } else if (url.startsWith("data:")) {
                                // Handle Data URL directly
                                new WebAppInterface(MainActivity.this).downloadBlob(url, mimetype);
                            } else {
                                // Handle regular URL
                                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                                request.setMimeType(mimetype);
                                String cookies = android.webkit.CookieManager.getInstance().getCookie(url);
                                request.addRequestHeader("cookie", cookies);
                                request.addRequestHeader("User-Agent", userAgent);
                                request.setDescription("Downloading file...");
                                
                                String fileName = URLUtil.guessFileName(url, contentDisposition, mimetype);
                                request.setTitle(fileName);
                                
                                request.allowScanningByMediaScanner();
                                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
                                
                                DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                                if (dm != null) {
                                    dm.enqueue(request);
                                    Toast.makeText(getApplicationContext(), "Download Started: " + fileName, Toast.LENGTH_SHORT).show();
                                }
                            }
                        } catch (Exception e) {
                            Toast.makeText(getApplicationContext(), "Download Error: " + e.getMessage(), Toast.LENGTH_LONG).show();
                            e.printStackTrace();
                        }
                    }
                });
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public class WebAppInterface {
        Context mContext;

        WebAppInterface(Context c) {
            mContext = c;
        }

        @JavascriptInterface
        public void downloadBlob(String base64Data, String mimeType) {
            try {
                String cleanBase64 = base64Data;
                String extension = "";
                
                if (base64Data.contains(",")) {
                    cleanBase64 = base64Data.split(",")[1];
                }
                
                // Guess extension
                MimeTypeMap mime = MimeTypeMap.getSingleton();
                extension = mime.getExtensionFromMimeType(mimeType);
                if (extension == null) extension = "bin";

                String fileName = "download_" + new SimpleDateFormat("yyyyMMdd_HHmmss").format(new Date()) + "." + extension;
                
                byte[] fileData = Base64.decode(cleanBase64, Base64.DEFAULT);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                    values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

                    ContentResolver resolver = mContext.getContentResolver();
                    Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);

                    if (uri != null) {
                        try (OutputStream outputStream = resolver.openOutputStream(uri)) {
                            if (outputStream != null) {
                                outputStream.write(fileData);
                                Toast.makeText(mContext, "Saved to Downloads: " + fileName, Toast.LENGTH_LONG).show();
                            }
                        }
                    }
                } else {
                    File path = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    File file = new File(path, fileName);
                    try (FileOutputStream fos = new FileOutputStream(file)) {
                        fos.write(fileData);
                        Toast.makeText(mContext, "Saved to Downloads: " + fileName, Toast.LENGTH_LONG).show();
                    }
                }
            } catch (IOException e) {
                Toast.makeText(mContext, "Failed to save blob: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                e.printStackTrace();
            }
        }
    }
}
