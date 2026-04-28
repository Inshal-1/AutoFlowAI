package com.auto.autoflow.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

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
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
