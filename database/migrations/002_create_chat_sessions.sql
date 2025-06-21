-- ¡„√»ª√∑ÁÛ∆¸÷Î\
-- Purpose: ˛qª√∑ÁÛ∂Kh∑ Í™2L°
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('roadmap', 'step_by_step')),
    current_step VARCHAR(50) DEFAULT 'initial',
    scenario_data JSONB DEFAULT '{}',
    context_data JSONB DEFAULT '{}',
    escalation_reason VARCHAR(100),
    escalated_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- §Û«√Øπ\
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_session_token ON chat_sessions(session_token);
CREATE INDEX idx_chat_sessions_mode ON chat_sessions(mode);
CREATE INDEX idx_chat_sessions_current_step ON chat_sessions(current_step);

-- Ù∞B;Í’Ù∞»Í¨¸
CREATE TRIGGER update_chat_sessions_updated_at 
    BEFORE UPDATE ON chat_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();