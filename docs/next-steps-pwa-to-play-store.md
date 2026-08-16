# Offset: Next Steps to PWA and Google Play Release

Current branch: `feature/android-capacitor`

Current implementation already includes:

- Static Next.js export to `out/`.
- Capacitor Android project with package ID `com.afterthought.offset`.
- Android target SDK 36 and version `1.1.2` / version code `1`.
- Browser PWA behavior and Android-native behavior separated.
- Native Android Google sign-in bridge.
- Client-side, Spark-plan-compatible account deletion.

## 1. Merge and deploy web/PWA

1. Merge `feature/android-capacitor` into `main` after review.
2. Deploy Firestore rules before publishing account deletion UI:

   ```powershell
   firebase deploy --only firestore:rules --project offset-9b6fb
   ```

3. Deploy web app normally.

   This app now uses Next static export. Hosting must publish `out/` after:

   ```powershell
   npm run build:web
   ```

   Do not run `next start` as production hosting for this build.
4. Test browser PWA:
   - Google login;
   - add/edit transaction;
   - statement detail page;
   - install prompt;
   - offline cached launch;
   - Settings -> Account -> Delete Account.

## 2. Configure local Android development

Install Android Studio and Android SDK Platform 36.

Set environment variables for current PowerShell session:

```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-22"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
```

Confirm:

```powershell
java -version
adb version
```

`ANDROID_HOME` is currently missing on this computer. Android Gradle build cannot run until SDK is installed/configured.

## 3. Configure Firebase Android Google sign-in

1. Firebase Console -> Project settings -> Add app -> Android.
2. Use package name:

   ```text
   com.afterthought.offset
   ```

3. Generate debug SHA-1:

   ```powershell
Set-Location android
.\gradlew.bat signingReport
Set-Location ..
   ```

4. Add debug SHA-1 in Firebase Android app settings.
5. Enable Google provider in Firebase Console -> Authentication -> Sign-in method.
6. Download `google-services.json` and place it here:

   ```text
   android/app/google-services.json
   ```

   Do not commit this file unless team policy explicitly permits it.
7. Sync Capacitor:

   ```powershell
npm run build:web
npx cap sync android
   ```

## 4. Build and test debug APK

Build:

```powershell
Set-Location android
.\gradlew.bat :app:assembleDebug
Set-Location ..
```

Expected output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Install on emulator or USB-connected phone:

```powershell
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Test on device:

- Google sign-in: complete, cancel, relaunch, sign out.
- Existing web account shows same cards/transactions.
- Add/edit/delete transaction and statement actions.
- Account deletion deletes data and login account.
- Offline launch and reconnect.
- Android Back behavior.
- No browser PWA install toast inside APK.

## 5. Finish Android visual assets

Before closed testing:

- Replace Capacitor default launcher icon with Offset adaptive icon.
- Replace default Capacitor splash artwork with Offset splash screen.
- Test dark status/navigation bars and display cutouts.
- Verify Offset app name and package ID in Android settings.

## 6. Prepare release signing

1. Create Android upload keystore. Keep it outside repository and back it up.
2. Configure release signing without committing passwords/keystore.
3. Build signed Android App Bundle (`.aab`) in Android Studio:

   ```text
Build -> Generate Signed Bundle / APK -> Android App Bundle
   ```

4. Expected release artifact:

   ```text
android/app/build/outputs/bundle/release/app-release.aab
   ```

5. Create Google Play Console app and enroll in Play App Signing.
6. Copy the Play App Signing certificate SHA-1 into Firebase Android app settings.

This last SHA-1 is required for Google sign-in in the Play-installed app.

## 7. Play Console submission

Complete:

- App name, category, short/full description.
- 512x512 icon, feature graphic, phone screenshots.
- Privacy policy URL: publicly accessible `/privacy` page.
- Data Safety form. Declare Firebase Auth profile data and user-entered financial/transaction data accurately.
- Account deletion details: Settings -> Account -> Delete Account.
- Content rating, ads declaration, target audience, reviewer login instructions.

Upload release AAB in this order:

```text
Internal testing -> Closed testing -> Production
```

Increase Android `versionCode` for every subsequent Play upload.

## Commands Reference

```powershell
# Web / PWA static production build
npm run build:web

# Copy current web build into Android project
npx cap sync android

# Open Android Studio
npm run android

# Deploy only Firestore rules; no Blaze plan required
firebase deploy --only firestore:rules --project offset-9b6fb
```

Do not run `firebase deploy --only functions:deleteAccount`; account deletion no longer uses Cloud Functions.
