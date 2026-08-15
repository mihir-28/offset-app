import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.afterthought.offset",
  appName: "Offset",
  webDir: "out",
  android: {
    allowMixedContent: false,
  },
};

export default config;
