package com.kawaiilife.app.feature.notifications

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kawaiilife.app.core.network.ApiService
import com.kawaiilife.app.data.model.NotificationDto
import com.kawaiilife.app.ui.components.*
import com.kawaiilife.app.ui.theme.KawaiiColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*
import javax.inject.Inject

@HiltViewModel
class NotificationsViewModel @Inject constructor(private val api: ApiService) : ViewModel() {
    private val _notifications = MutableStateFlow<List<NotificationDto>>(emptyList())
    val notifications: StateFlow<List<NotificationDto>> = _notifications.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _loading.value = true
            try { _notifications.value = api.getNotifications() }
            catch (_: Exception) {}
            finally { _loading.value = false }
        }
    }

    fun markRead(id: String) {
        viewModelScope.launch {
            try {
                api.markNotificationRead(id)
                _notifications.value = _notifications.value.map {
                    if (it.id == id) it.copy(read = true) else it
                }
            } catch (_: Exception) {}
        }
    }

    fun markAllRead() {
        viewModelScope.launch {
            try {
                api.markAllNotificationsRead()
                _notifications.value = _notifications.value.map { it.copy(read = true) }
            } catch (_: Exception) {}
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsScreen(viewModel: NotificationsViewModel = hiltViewModel()) {
    val notifications by viewModel.notifications.collectAsState()
    val loading by viewModel.loading.collectAsState()
    val unreadCount = notifications.count { !it.read }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Notifications 🔔", fontWeight = FontWeight.Bold) },
                actions = {
                    if (unreadCount > 0) {
                        TextButton(onClick = { viewModel.markAllRead() }) {
                            Text("Mark all read", color = KawaiiColors.Pink)
                        }
                    }
                    IconButton(onClick = { viewModel.load() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        when {
            loading -> LoadingScreen()
            notifications.isEmpty() -> EmptyState(
                    icon = "🔔",
                    title = "No notifications",
                    message = "You're all caught up!",
                    actionLabel = null,
                    onAction = {}
                )
            else -> LazyColumn(
                modifier = Modifier.padding(padding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(notifications, key = { it.id }) { notif ->
                    NotificationCard(notification = notif, onRead = { viewModel.markRead(notif.id) })
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NotificationCard(notification: NotificationDto, onRead: () -> Unit) {
    val typeEmoji = when (notification.type) {
        "task" -> "✅"
        "chat" -> "💬"
        "friend" -> "👥"
        "achievement" -> "🏆"
        "watch" -> "🎬"
        else -> "🔔"
    }

    KawaiiCard(onClick = { if (!notification.read) onRead() }) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.Top
        ) {
            Text(typeEmoji, style = MaterialTheme.typography.titleLarge)
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    notification.title,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = if (!notification.read) FontWeight.Bold else FontWeight.Normal
                )
                notification.body?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text(
                    SimpleDateFormat("MMM d, h:mm a", Locale.getDefault()).format(Date(notification.createdAt)),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            if (!notification.read) {
                KawaiiTag("New", KawaiiColors.Pink)
            }
        }
    }
}
