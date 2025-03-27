package com.anonymous.PlantDiseasePredictionAppClassic // Your namespace

import android.app.Application
import android.content.res.Configuration

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader // Correct SoLoader import

// --- Expo Imports ---
import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper
// --- REMOVE these specific adapter/provider imports, they should be handled by ReactNativeHostWrapper ---
// import expo.modules.adapters.react.ReactAdapterPackage
// import expo.modules.adapters.react.ModuleRegistryAdapter
// import expo.modules.core.interfaces.Package
// import expo.modules.core.interfaces.SingletonModule
// --- End Expo Imports ---


class MainApplication : Application(), ReactApplication {

    // --- REMOVE the manual ModuleRegistryProvider ---
    // private val mModuleRegistryProvider = expo.modules.manifest.ModuleRegistryProvider(expo.modules.manifest.BasePackageList().getPackageList())


    override val reactNativeHost: ReactNativeHost = ReactNativeHostWrapper(
        this,
        object : DefaultReactNativeHost(this) {

            // --- Corrected getPackages() ---
            // The ReactNativeHostWrapper should handle adding Expo modules automatically
            // when using PackageList like this in modern Expo.
            override fun getPackages(): List<ReactPackage> =
                PackageList(this).packages.apply {
                    // Packages that cannot be autolinked yet can be added manually here
                    // packages.add(new MyReactNativePackage());

                    // No need to manually add ModuleRegistryAdapter here if using ReactNativeHostWrapper
                }
            // --- END Corrected getPackages() ---


            override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"

            override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

            override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
            override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
        }
    )

    override val reactHost: ReactHost
        get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)

    override fun onCreate() {
        super.onCreate()
        SoLoader.init(this, false) // Correct SoLoader init
        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
            load()
        }
        ApplicationLifecycleDispatcher.onApplicationCreate(this)
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
    }
}