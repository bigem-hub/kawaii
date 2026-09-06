package com.kawaiilife.app.feature.watch

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import androidx.hilt.navigation.compose.hiltViewModel
import com.kawaiilife.app.data.model.WatchRoomDto
import com.kawaiilife.app.ui.components.*
import com.kawaiilife.app.ui.theme.KawaiiColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WatchScreen(viewModel: WatchViewModel = hiltViewModel()) {
    val rooms by viewModel.rooms.collectAsState()
    val activeRoom by viewModel.activeRoom.collectAsState()
    val loading by viewModel.loading.collectAsState()
    var showCreateSheet by remember { mutableStateOf(false) }

    if (activeRoom != null) {
        WatchRoomScreen(viewModel = viewModel)
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Watch Together 🎬", fontWeight = FontWeight.Bold) },
                actions = {
                    IconButton(onClick = { viewModel.loadRooms() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showCreateSheet = true },
                containerColor = KawaiiColors.Pink,
                contentColor = Color.White
            ) { Icon(Icons.Default.Add, contentDescription = "Create room") }
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            when {
                loading -> LoadingScreen()
                rooms.isEmpty() -> EmptyState(
                    icon = "🎬",
                    title = "No watch rooms",
                    message = "Create a room to watch with friends!",
                    actionLabel = "Create room",
                    onAction = { showCreateSheet = true }
                )
                else -> LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(rooms, key = { it.id }) { room ->
                        WatchRoomCard(room = room, onJoin = { viewModel.joinRoom(room.id) })
                    }
                }
            }
        }
    }

    if (showCreateSheet) {
        CreateRoomSheet(
            onDismiss = { showCreateSheet = false },
            onCreate = { name, url ->
                viewModel.createRoom(name, url)
                showCreateSheet = false
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun WatchRoomScreen(viewModel: WatchViewModel) {
    val room by viewModel.activeRoom.collectAsState()
    val isPlaying by viewModel.isPlaying.collectAsState()
    var chatText by remember { mutableStateOf("") }
    val messages by viewModel.roomMessages.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(room?.name ?: "Watch Room", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = { viewModel.leaveRoom() }) {
                        Icon(Icons.Default.ExitToApp, contentDescription = "Leave")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding).fillMaxSize()) {
            // Video Player
            if (room != null && room!!.videoUrl.isNotBlank()) {
                VideoPlayer(
                    videoUrl = room!!.videoUrl,
                    isPlaying = isPlaying,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                )
            } else {
                Surface(
                    modifier = Modifier.fillMaxWidth().height(220.dp).padding(16.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text("No video URL provided", style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }

            // Playback controls
            Row(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = { viewModel.seek(0L) }) {
                    Icon(Icons.Default.SkipPrevious, contentDescription = "Restart", modifier = Modifier.size(32.dp))
                }
                Spacer(Modifier.width(16.dp))
                FloatingActionButton(
                    onClick = {
                        if (isPlaying) viewModel.pause(0L)
                        else viewModel.play(0L)
                    },
                    containerColor = KawaiiColors.Pink,
                    contentColor = Color.White,
                    modifier = Modifier.size(56.dp)
                ) {
                    Icon(
                        if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                        contentDescription = if (isPlaying) "Pause" else "Play",
                        modifier = Modifier.size(28.dp)
                    )
                }
            }

            Divider()

            // Room chat
            Text("Room Chat", style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(start = 16.dp, top = 8.dp))

            LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
                reverseLayout = true
            ) {
                items(messages, key = { it.id }) { msg ->
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(msg.sender?.displayName ?: "?", fontWeight = FontWeight.Medium, style = MaterialTheme.typography.labelMedium, color = KawaiiColors.Pink)
                        Text(msg.content, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }

            Row(modifier = Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = chatText,
                    onValueChange = { chatText = it },
                    placeholder = { Text("Say something…") },
                    singleLine = true,
                    shape = RoundedCornerShape(20.dp),
                    modifier = Modifier.weight(1f)
                )
                IconButton(onClick = { viewModel.sendChat(chatText); chatText = "" }) {
                    Icon(Icons.Default.Send, contentDescription = "Send", tint = KawaiiColors.Pink)
                }
            }
        }
    }
}

@Composable
private fun WatchRoomCard(room: WatchRoomDto, onJoin: () -> Unit) {
    KawaiiCard(onClick = onJoin) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(room.name, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
                Text(
                    "${room.participants.size} watching • ${room.videoUrl}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1
                )
            }
            KawaiiButton(text = "Join", onClick = onJoin)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CreateRoomSheet(onDismiss: () -> Unit, onCreate: (String, String) -> Unit) {
    var name by remember { mutableStateOf("") }
    var url by remember { mutableStateOf("") }

    ModalBottomSheet(onDismissRequest = onDismiss, shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp)) {
        Column(modifier = Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("Create Watch Room", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Room name") }, shape = RoundedCornerShape(16.dp), singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = url, onValueChange = { url = it }, label = { Text("Video URL") }, shape = RoundedCornerShape(16.dp), singleLine = true, modifier = Modifier.fillMaxWidth())
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(onClick = onDismiss, modifier = Modifier.weight(1f), shape = RoundedCornerShape(16.dp)) { Text("Cancel") }
                KawaiiButton(text = "Create", onClick = { if (name.isNotBlank() && url.isNotBlank()) onCreate(name, url) }, enabled = name.isNotBlank() && url.isNotBlank(), modifier = Modifier.weight(1f))
            }
            Spacer(Modifier.height(8.dp))
        }
    }
}
