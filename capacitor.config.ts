import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.afterthought.offset",
  appName: "Offset",
  webDir: "out",
  android: {
    allowMixedContent: false,
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: "DARK",
      backgroundColor: "#09090B",
    },
    FirebaseAuthentication: {
      providers: ["google.com"],
      skipNativeAuth: true,
    },
    PushNotifications: {
      presentationOptions: ["sound", "alert"],
    },
  },
};

export default config;
