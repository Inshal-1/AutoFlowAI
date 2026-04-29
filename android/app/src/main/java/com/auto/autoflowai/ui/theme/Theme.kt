package com.auto.autoflow.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val DarkColorScheme = darkColorScheme(
    primary = CrimsonRed,
    onPrimary = OnPrimaryDark,
    primaryContainer = CrimsonRed.copy(alpha = 0.3f),
    onPrimaryContainer = CrimsonRedLight,
    secondary = CharcoalLight,
    onSecondary = OnSecondaryDark,
    secondaryContainer = CharcoalLight.copy(alpha = 0.3f),
    onSecondaryContainer = OnSurfaceDark,
    tertiary = GoldenAccent,
    onTertiary = CharcoalDark,
    tertiaryContainer = GoldenAccent.copy(alpha = 0.3f),
    onTertiaryContainer = GoldenAccentLight,
    background = BackgroundDark,
    onBackground = OnBackgroundDark,
    surface = SurfaceDark,
    onSurface = OnSurfaceDark,
    surfaceVariant = CharcoalLight,
    onSurfaceVariant = OnSurfaceVariantDark,
    error = StatusRed,
    onError = OnPrimaryDark,
    errorContainer = StatusRed.copy(alpha = 0.2f),
    onErrorContainer = StatusRed,
    outline = OnSurfaceVariantDark
)

private val LightColorScheme = lightColorScheme(
    primary = CrimsonRed,
    onPrimary = OnPrimaryLight,
    primaryContainer = CrimsonRedLight.copy(alpha = 0.2f),
    onPrimaryContainer = CrimsonRed,
    secondary = CharcoalDark,
    onSecondary = OnSecondaryLight,
    secondaryContainer = SurfaceLight,
    onSecondaryContainer = CharcoalDark,
    tertiary = GoldenAccent,
    onTertiary = CharcoalDark,
    tertiaryContainer = GoldenAccentLight.copy(alpha = 0.3f),
    onTertiaryContainer = CharcoalDark,
    background = BackgroundLight,
    onBackground = OnBackgroundLight,
    surface = SurfaceLight,
    onSurface = OnSurfaceLight,
    surfaceVariant = SurfaceLight,
    onSurfaceVariant = OnSurfaceVariantLight,
    error = StatusRed,
    onError = OnPrimaryLight,
    errorContainer = StatusRed.copy(alpha = 0.1f),
    onErrorContainer = StatusRed,
    outline = OnSurfaceVariantLight
)

@Composable
fun AutoFlowTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    // Dynamic color is available on Android 12+
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.surface.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
