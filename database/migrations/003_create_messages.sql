-- ·√ª¸∏∆¸÷Î\
-- Purpose: ¡„√»ethAI‹Tn2
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    embedding_vector FLOAT8[],
    confidence_score DECIMAL(3,2),
    response_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- §Û«√Øπ\
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_message_type ON messages(message_type);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_confidence_score ON messages(confidence_score);

-- GIN§Û«√ØπJSONB"(	
CREATE INDEX idx_messages_metadata ON messages USING GIN (metadata);