package com.kawaiilife.app.feature.friends

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import androidx.hilt.navigation.compose.hiltViewModel
import com.kawaiilife.app.data.model.*
import com.kawaiilife.app.ui.components.*
import com.kawaiilife.app.ui.theme.KawaiiColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FriendsScreen(viewModel: FriendsViewModel = hiltViewModel()) {
    val friends by viewModel.friends.collectAsState()
    val requests by viewModel.requests.collectAsState()
    val searchResults by viewModel.searchResults.collectAsState()
    val loading by viewModel.loading.collectAsState()
    var tab by remember { mutableStateOf(0) }
    var searchQuery by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Friends 👥", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            // Search bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it; viewModel.search(it) },
                placeholder = { Text("Search users…") },
                leadingIcon = { Icon(Icons.Default.Search, null) },
                shape = RoundedCornerShape(16.dp),
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)
            )

            if (searchQuery.isNotBlank() && searchResults.isNotEmpty()) {
                // Search results
                Text(
                    "Search results",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(start = 16.dp, top = 8.dp)
                )
                LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(searchResults, key = { it.id }) { user ->
                        SearchUserCard(user = user, onAdd = { viewModel.sendRequest(user.id) })
                    }
                }
            } else {
                TabRow(
                    selectedTabIndex = tab,
                    containerColor = MaterialTheme.colorScheme.background,
                    contentColor = KawaiiColors.Pink
                ) {
                    Tab(selected = tab == 0, onClick = { tab = 0 }, text = {
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("Friends")
                            if (friends.isNotEmpty()) KawaiiTag(friends.size.toString(), KawaiiColors.Pink)
                        }
                    })
                    Tab(selected = tab == 1, onClick = { tab = 1 }, text = {
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("Requests")
                            if (requests.isNotEmpty()) KawaiiTag(requests.size.toString(), KawaiiColors.Purple)
                        }
                    })
                }

                when {
                    loading -> LoadingScreen()
                    tab == 0 -> {
                        if (friends.isEmpty()) {
                            EmptyState(
                                icon = "👥",
                                title = "No friends yet",
                                message = "Search for users to add them",
                                actionLabel = null,
                                onAction = {}
                            )
                        } else {
                            LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                items(friends, key = { it.id }) { friend ->
                                    FriendCard(friend = friend, onRemove = { viewModel.removeFriend(friend.id) })
                                }
                            }
                        }
                    }
                    else -> {
                        if (requests.isEmpty()) {
                            EmptyState(
                                icon = "📬",
                                title = "No pending requests",
                                message = "Friend requests will appear here",
                                actionLabel = null,
                                onAction = {}
                            )
                        } else {
                            LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                items(requests, key = { it.id }) { req ->
                                    FriendRequestCard(
                                        request = req,
                                        onAccept = { viewModel.acceptRequest(req.id) },
                                        onDecline = { viewModel.declineRequest(req.id) }
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FriendCard(friend: FriendDto, onRemove: () -> Unit) {
    KawaiiCard {
        Row(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                KawaiiAvatar(name = friend.displayName, avatarUrl = friend.avatar, size = 44.dp, online = friend.online)
                Column {
                    Text(friend.displayName, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
                    Text(
                        if (friend.online) "Online" else "Offline",
                        style = MaterialTheme.typography.labelSmall,
                        color = if (friend.online) KawaiiColors.Green else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            IconButton(onClick = onRemove) {
                Icon(Icons.Default.PersonRemove, contentDescription = "Remove", tint = KawaiiColors.Error)
            }
        }
    }
}

@Composable
private fun FriendRequestCard(request: FriendRequestDto, onAccept: () -> Unit, onDecline: () -> Unit) {
    KawaiiCard {
        Row(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                KawaiiAvatar(name = request.sender?.displayName, size = 44.dp)
                Column {
                    Text(request.sender?.displayName ?: "Unknown", style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
                    Text("Wants to be friends", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                IconButton(onClick = onDecline) { Icon(Icons.Default.Close, contentDescription = "Decline", tint = KawaiiColors.Error) }
                IconButton(onClick = onAccept) { Icon(Icons.Default.Check, contentDescription = "Accept", tint = KawaiiColors.Green) }
            }
        }
    }
}

@Composable
private fun SearchUserCard(user: UserDto, onAdd: () -> Unit) {
    KawaiiCard {
        Row(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                KawaiiAvatar(name = user.displayName, avatarUrl = user.avatar, size = 44.dp)
                Text(user.displayName, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
            }
            IconButton(onClick = onAdd) {
                Icon(Icons.Default.PersonAdd, contentDescription = "Add friend", tint = KawaiiColors.Pink)
            }
        }
    }
}
