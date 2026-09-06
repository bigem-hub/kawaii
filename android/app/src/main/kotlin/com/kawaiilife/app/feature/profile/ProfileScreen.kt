package com.kawaiilife.app.feature.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import androidx.hilt.navigation.compose.hiltViewModel
import com.kawaiilife.app.data.model.AchievementDto
import com.kawaiilife.app.ui.components.*
import com.kawaiilife.app.ui.theme.KawaiiColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    username: String? = null,
    viewModel: ProfileViewModel = hiltViewModel(),
    onLogout: () -> Unit = {}
) {
    val profile by viewModel.profile.collectAsState()
    val achievements by viewModel.achievements.collectAsState()
    val loading by viewModel.loading.collectAsState()
    var editMode by remember { mutableStateOf(false) }
    var displayName by remember { mutableStateOf("") }
    var bio by remember { mutableStateOf("") }
    val saveSuccess by viewModel.saveSuccess.collectAsState()

    LaunchedEffect(profile) {
        profile?.let {
            displayName = it.displayName
            bio = it.bio ?: ""
        }
    }

    LaunchedEffect(saveSuccess) {
        if (saveSuccess) { editMode = false; viewModel.clearSaveSuccess() }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Profile ✨", fontWeight = FontWeight.Bold) },
                actions = {
                    IconButton(onClick = { editMode = !editMode }) {
                        Icon(if (editMode) Icons.Default.Close else Icons.Default.Edit, contentDescription = "Edit")
                    }
                    IconButton(onClick = { viewModel.logout(); onLogout() }) {
                        Icon(Icons.Default.Logout, contentDescription = "Logout", tint = KawaiiColors.Error)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        if (loading) { LoadingScreen(); return@Scaffold }

        LazyColumn(
            modifier = Modifier.padding(padding),
            contentPadding = PaddingValues(bottom = 32.dp)
        ) {
            item {
                // Header gradient
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(160.dp)
                        .background(
                            Brush.linearGradient(listOf(KawaiiColors.Pink.copy(alpha = 0.4f), KawaiiColors.Purple.copy(alpha = 0.4f)))
                        ),
                    contentAlignment = Alignment.BottomCenter
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(bottom = 16.dp)) {
                        KawaiiAvatar(
                            name = profile?.displayName,
                            avatarUrl = profile?.avatar,
                            size = 80.dp
                        )
                    }
                }
            }

            item {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    if (editMode) {
                        OutlinedTextField(
                            value = displayName,
                            onValueChange = { displayName = it },
                            label = { Text("Display name") },
                            shape = RoundedCornerShape(16.dp),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(Modifier.height(10.dp))
                        OutlinedTextField(
                            value = bio,
                            onValueChange = { bio = it },
                            label = { Text("Bio") },
                            shape = RoundedCornerShape(16.dp),
                            minLines = 2,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(Modifier.height(12.dp))
                        KawaiiButton(
                            text = "Save changes",
                            onClick = { viewModel.updateProfile(displayName, bio.takeIf { it.isNotBlank() }) },
                            modifier = Modifier.fillMaxWidth()
                        )
                    } else {
                        Text(
                            profile?.displayName ?: "User",
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold
                        )
                        profile?.bio?.let {
                            Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }

                        Spacer(Modifier.height(16.dp))

                        // XP / streak badges
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            profile?.let { p ->
                                KawaiiTag(text = "⚡ ${p.xp} XP", color = KawaiiColors.Purple)
                                KawaiiTag(text = "🔥 ${p.streak} streak", color = KawaiiColors.Peach)
                            }
                        }
                    }
                }
            }

            // Achievements section
            if (achievements.isNotEmpty()) {
                item {
                    Text(
                        "Achievements 🏆",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(start = 24.dp, top = 8.dp, bottom = 8.dp)
                    )
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(achievements) { ach ->
                            AchievementBadge(achievement = ach)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AchievementBadge(achievement: AchievementDto) {
    KawaiiCard {
        Column(
            modifier = Modifier.padding(14.dp).width(100.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(achievement.icon, style = MaterialTheme.typography.headlineMedium)
            Text(achievement.name, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Medium)
        }
    }
}
