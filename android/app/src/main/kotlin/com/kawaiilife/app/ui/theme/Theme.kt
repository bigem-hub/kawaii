package com.kawaiilife.app.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val LightColorScheme = lightColorScheme(
    primary          = KawaiiColors.Pink,
    onPrimary        = Color.White,
    primaryContainer = KawaiiColors.Lavender,
    onPrimaryContainer = Color(0xFF3D0050),
    secondary        = KawaiiColors.Purple,
    onSecondary      = Color.White,
    secondaryContainer = Color(0xFFEDD9FF),
    onSecondaryContainer = Color(0xFF2D004A),
    background       = KawaiiColors.BgLight,
    onBackground     = KawaiiColors.TextPrimaryLight,
    surface          = KawaiiColors.SurfaceLight,
    onSurface        = KawaiiColors.TextPrimaryLight,
    surfaceVariant   = KawaiiColors.Surface2Light,
    onSurfaceVariant = KawaiiColors.TextMutedLight,
    outline          = KawaiiColors.BorderLight,
    error            = KawaiiColors.Error
)

private val DarkColorScheme = darkColorScheme(
    primary          = KawaiiColors.Pink,
    onPrimary        = Color(0xFF560033),
    primaryContainer = Color(0xFF7A0049),
    onPrimaryContainer = KawaiiColors.Lavender,
    secondary        = KawaiiColors.Purple,
    onSecondary      = Color(0xFF46006E),
    secondaryContainer = Color(0xFF62008F),
    onSecondaryContainer = KawaiiColors.Lavender,
    background       = KawaiiColors.BgDark,
    onBackground     = KawaiiColors.TextPrimaryDark,
    surface          = KawaiiColors.SurfaceDark,
    onSurface        = KawaiiColors.TextPrimaryDark,
    surfaceVariant   = KawaiiColors.Surface2Dark,
    onSurfaceVariant = KawaiiColors.TextMutedDark,
    outline          = KawaiiColors.BorderDark,
    error            = Color(0xFFFFB4AB)
)

// Accent color preference that can be changed in settings
val LocalAccentColor = compositionLocalOf { KawaiiColors.Pink }

@Composable
fun KawaiiLifeTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    accentColor: Color = KawaiiColors.Pink,
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.background.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    CompositionLocalProvider(LocalAccentColor provides accentColor) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = KawaiiTypography,
            content = content
        )
    }
}
