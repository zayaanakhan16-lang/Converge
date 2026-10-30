package app.converge.audio;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;

import java.util.Collections;
import java.util.List;

/**
 * Registers the Converge native modules with React Native.
 *
 * <p>Expo autolinking picks this up automatically: a class implementing
 * {@link ReactPackage} inside the app package of an Android project is
 * discovered at build time, so no hand-edited {@code MainApplication} entry is
 * required.
 */
public class ConvergeAudioPackage implements ReactPackage {

    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext context) {
        return Collections.singletonList(new ConvergeAudioModule(context));
    }

    @Override
    public List<com.facebook.react.uimanager.ViewManager> createViewManagers(
            ReactApplicationContext context) {
        // The package contributes no UI components.
        return Collections.emptyList();
    }
}
