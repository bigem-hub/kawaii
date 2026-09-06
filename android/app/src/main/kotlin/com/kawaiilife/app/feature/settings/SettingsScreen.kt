package com.kawaiilife.app.feature.settings

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import com.kawaiilife.app.ui.components.KawaiiCard
import com.kawaiilife.app.ui.theme.KawaiiColors
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor() : ViewModel() {
    var darkMode by mutableStateOf(false)
        private set
    var notificationsEnabled by mutableStateOf(true)
        private set
    var biometricEnabled by mutableStateOf(false)
        private set
    var compactMode by mutableStateOf(false)
        private set

    fun toggleDarkMode() { darkMode = !darkMode }
    fun toggleNotifications() { notificationsEnabled = !notificationsEnabled }
    fun toggleBiometric() { biometricEnabled = !biometricEnabled }
    fun toggleCompactMode() { compactMode = !compactMode }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(viewModel: SettingsViewModel = hiltViewModel()) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings ⚙️", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            item { SectionLabel("Appearance") }
            item {
                SettingsToggleItem(
                    icon = Icons.Default.DarkMode,
                    title = "Dark mode",
                    subtitle = "Switch between light and dark theme",
                    checked = viewModel.darkMode,
                    onToggle = { viewModel.toggleDarkMode() }
                )
            }
            item {
                SettingsToggleItem(
                    icon = Icons.Default.TableRows,
                    title = "Compact mode",
                    subtitle = "Show more content with less spacing",
                    checked = viewModel.compactMode,
                    onToggle = { viewModel.toggleCompactMode() }
                )
            }

            item { SectionLabel("Notifications") }
            item {
                SettingsToggleItem(
                    icon = Icons.Default.Notifications,
                    title = "Push notifications",
                    subtitle = "Receive alerts for messages, reminders, and more",
                    checked = viewModel.notificationsEnabled,
                    onToggle = { viewModel.toggleNotifications() }
                )
            }

            item { SectionLabel("Security") }
            item {
                SettingsToggleItem(
                    icon = Icons.Default.Fingerprint,
                    title = "Biometric login",
                    subtitle = "Use fingerprint or face to unlock",
                    checked = viewModel.biometricEnabled,
                    onToggle = { viewModel.toggleBiometric() }
                )
            }

            item { SectionLabel("About") }
            item {
                KawaiiCard {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("KawaiiLife", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                        Text("Version 1.0.0", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text("Made with 💖", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.labelMedium,
        color = KawaiiColors.Pink,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.padding(start = 4.dp, top = 8.dp, bottom = 4.dp)
    )
}

@Composable
private fun SettingsToggleItem(
    icon: ImageVector,
    title: String,
    subtitle: String,
    checked: Boolean,
    onToggle: () -> Unit
) {
    KawaiiCard {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                Icon(icon, contentDescription = null, tint = KawaiiColors.Pink, modifier = Modifier.size(22.dp))
                Column {
                    Text(title, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
                    Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Switch(
                checked = checked,
                onCheckedChange = { onToggle() },
                colors = SwitchDefaults.colors(checkedThumbColor = KawaiiColors.Pink, checkedTrackColor = KawaiiColors.Pink.copy(alpha = 0.3f))
            )
        }
    }
}
