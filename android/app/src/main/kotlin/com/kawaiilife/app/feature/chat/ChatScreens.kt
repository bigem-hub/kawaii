package com.kawaiilife.app.feature.chat

import androidx.compose.animation.*
import androidx.compose.animation.core.AnimationSpec
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import androidx.hilt.navigation.compose.hiltViewModel
import com.kawaiilife.app.data.model.*
import com.kawaiilife.app.feature.auth.AuthViewModel
import com.kawaiilife.app.ui.components.*
import com.kawaiilife.app.ui.theme.KawaiiColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatListScreen(
    viewModel: ChatListViewModel = hiltViewModel(),
    authViewModel: AuthViewModel = hiltViewModel(),
    onOpenChat: (String) -> Unit
) {
    val conversations by viewModel.conversations.collectAsState()
    val loading by viewModel.loading.collectAsState()
    val currentUser = authViewModel.getUser()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Chat 💬", fontWeight = FontWeight.Bold) },
                actions = {
                    IconButton(onClick = { viewModel.load() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            when {
                loading -> LoadingScreen()
                conversations.isEmpty() -> EmptyState(
                    icon = "💬",
                    title = "No conversations yet",
                    message = "Start a chat with a friend!",
                    actionLabel = "Add friends",
                    onAction = { /* navigate to friends */ }
                )
                else -> LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(conversations, key = { it.id }) { conv ->
                        ConversationCard(
                            conversation = conv,
                            currentUserId = currentUser?.id ?: "",
                            onClick = { onOpenChat(conv.id) }
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ConversationCard(
    conversation: ConversationDto,
    currentUserId: String,
    onClick: () -> Unit
) {
    val otherUser = conversation.members.firstOrNull { it.id != currentUserId } ?: conversation.members.firstOrNull()
    KawaiiCard(onClick = onClick) {
        Row(modifier = Modifier.padding(14.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            KawaiiAvatar(
                name = otherUser?.displayName,
                avatarUrl = otherUser?.avatar,
                size = 48.dp,
                online = otherUser?.online ?: false
            )
            Column(modifier = Modifier.weight(1f)) {
                Row(horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(
                        conversation.name ?: otherUser?.displayName ?: "Unknown",
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Medium
                    )
                    conversation.lastMessage?.createdAt?.let { time ->
                        Text(
                            formatTime(time),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                Text(
                    conversation.lastMessage?.content ?: "No messages yet",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1
                )
            }
            if (conversation.unreadCount > 0) {
                KawaiiTag(
                    text = conversation.unreadCount.toString(),
                    color = KawaiiColors.Pink,
                    modifier = Modifier.padding(start = 8.dp)
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    conversationId: String,
    onBack: () -> Unit,
    viewModel: ChatViewModel = hiltViewModel(),
    authViewModel: AuthViewModel = hiltViewModel()
) {
    val messages by viewModel.messages.collectAsState()
    val loading by viewModel.loading.collectAsState()
    val typingUsers by viewModel.typingUsers.collectAsState()
    var messageText by remember { mutableStateOf("") }
    val currentUser = authViewModel.getUser()

    viewModel.init(conversationId)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Chat", fontWeight = FontWeight.Bold) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Back") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding).fillMaxSize()) {
            // Messages
            Column(modifier = Modifier.weight(1f)) {
                if (loading) LoadingScreen()
                else {
                    LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        reverseLayout = true,
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(messages, key = { it.id }) { msg ->
                            MessageBubble(
                                message = msg,
                                isOwn = msg.senderId == currentUser?.id
                            )
                        }
                    }
                }
            }


            // Typing indicator
            if (typingUsers.values.isNotEmpty()) {
                AnimatedVisibility(visible = typingUsers.values.isNotEmpty()) {
                    Row(modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) {
                        Text("Someone is typing…", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Spacer(Modifier.width(4.dp))
                        TypingDots()
                    }
                }
            }

            // Input
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.surface
            ) {
                Row(modifier = Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(
                        value = messageText,
                        onValueChange = { messageText = it; viewModel.setTyping(true) },
                        placeholder = { Text("Message…") },
                        singleLine = true,
                        shape = RoundedCornerShape(20.dp),
                        modifier = Modifier.weight(1f).fillMaxWidth(),
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(imeAction = androidx.compose.ui.text.input.ImeAction.Send),
                        keyboardActions = androidx.compose.foundation.text.KeyboardActions(onDone = { viewModel.sendMessage(messageText); messageText = ""; viewModel.setTyping(false) })
                    )
                    IconButton(onClick = { viewModel.sendMessage(messageText); messageText = "" }) {
                        Icon(Icons.Default.Send, contentDescription = "Send", tint = KawaiiColors.Pink)
                    }
                }
            }
        }
    }
}

@Composable
private fun TypingDots() {
    val infiniteTransition = rememberInfiniteTransition(label = "typing")
    Row {
        (0..2).forEach { i ->
            val scale by infiniteTransition.animateFloat(
                initialValue = 0.5f, targetValue = 1f,
                animationSpec = infiniteRepeatable(
                    animation = tween(600, delayMillis = i * 200),
                    repeatMode = RepeatMode.Reverse
                )
            )
            Box(
                modifier = Modifier
                    .size(6.dp)
                    .graphicsLayer { scaleX = scale; scaleY = scale }
                    .background(KawaiiColors.Pink, CircleShape)
            )
            Spacer(Modifier.width(2.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MessageBubble(
    message: MessageDto,
    isOwn: Boolean
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isOwn) Arrangement.End else Arrangement.Start
    ) {
        if (!isOwn) {
            KawaiiAvatar(name = message.sender?.displayName, size = 28.dp, modifier = Modifier.padding(end = 8.dp))
        }
        Column(horizontalAlignment = if (isOwn) Alignment.End else Alignment.Start) {
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = if (isOwn) KawaiiColors.Pink else MaterialTheme.colorScheme.surfaceVariant,
                modifier = Modifier
                    .fillMaxWidth(0.75f)
                    .padding(horizontal = 12.dp, vertical = 8.dp)
            ) {
                Text(
                    message.content,
                    color = if (isOwn) Color.White else MaterialTheme.colorScheme.onSurface,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
            Text(
                formatTime(message.createdAt),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
            )
        }
        if (isOwn) {
            KawaiiAvatar(name = "You", size = 28.dp, modifier = Modifier.padding(start = 8.dp))
        }
    }
}

private fun formatTime(ms: Long): String {
    val sdf = java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault())
    return sdf.format(java.util.Date(ms))
}