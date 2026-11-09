package com.evermoments.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // Taille du texte du téléphone : suivie, mais plafonnée à 115 % pour que les pages ne débordent pas
    // (avec « police très grande », les titres sortaient de l'écran).
    WebSettings settings = getBridge().getWebView().getSettings();
    settings.setTextZoom(Math.min(settings.getTextZoom(), 115));
  }
}
