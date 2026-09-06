package com.kawaiilife.app.data.repository

import com.google.firebase.database.FirebaseDatabase
import com.kawaiilife.app.data.model.MessageDto
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class FirebaseRepository @Inject constructor(
    private val database: FirebaseDatabase
) {
    private val messagesRef = database.getReference("messages")

    fun getMessages(conversationId: String): Flow<List<MessageDto>> = callbackFlow {
        val query = messagesRef.child(conversationId).orderByChild("createdAt")
        
        val listener = query.addValueEventListener(object : com.google.firebase.database.ValueEventListener {
            override fun onDataChange(snapshot: com.google.firebase.database.DataSnapshot) {
                val messages = snapshot.children.mapNotNull { it.getValue(MessageDto::class.java) }
                trySend(messages)
            }

            override fun onCancelled(error: com.google.firebase.database.DatabaseError) {
                close(error.toException())
            }
        })
        
        awaitClose { query.removeEventListener(listener) }
    }

    fun sendMessage(conversationId: String, message: MessageDto) {
        val newMsgRef = messagesRef.child(conversationId).push()
        val msgWithId = message.copy(id = newMsgRef.key ?: "")
        newMsgRef.setValue(msgWithId)
    }
}
