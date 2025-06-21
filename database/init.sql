-- ===========================================
-- MNP Chatbot Database Initialization
-- ===========================================

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA public;

-- Create updated_at function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(20),
    current_carrier VARCHAR(50),
    target_carrier VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'escalated')),
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for users
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create chat_sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
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

-- Create trigger for chat_sessions
CREATE TRIGGER update_chat_sessions_updated_at 
    BEFORE UPDATE ON chat_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    embedding_vector vector(1536),
    confidence_score DECIMAL(3,2),
    response_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create faqs table
CREATE TABLE IF NOT EXISTS faqs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(50) NOT NULL,
    subcategory VARCHAR(50),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    keywords TEXT[],
    embedding_vector vector(1536),
    priority INTEGER DEFAULT 1,
    carrier_specific VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for faqs
CREATE TRIGGER update_faqs_updated_at 
    BEFORE UPDATE ON faqs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create escalation_tickets table
CREATE TABLE IF NOT EXISTS escalation_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    ticket_number VARCHAR(50) UNIQUE NOT NULL,
    reason TEXT NOT NULL,
    urgency_level VARCHAR(10) CHECK (urgency_level IN ('low', 'medium', 'high')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'resolved', 'closed')),
    customer_info JSONB DEFAULT '{}',
    context_data JSONB DEFAULT '{}',
    assigned_agent VARCHAR(100),
    estimated_wait_time INTEGER,
    line_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for escalation_tickets
CREATE TRIGGER update_escalation_tickets_updated_at 
    BEFORE UPDATE ON escalation_tickets 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create scenario_progress table
CREATE TABLE IF NOT EXISTS scenario_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_token VARCHAR(255) UNIQUE NOT NULL,
    current_step VARCHAR(50) NOT NULL,
    completed_steps JSONB DEFAULT '[]',
    collected_data JSONB DEFAULT '{}',
    progress INTEGER DEFAULT 0,
    estimated_completion TIMESTAMP WITH TIME ZONE,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for scenario_progress
CREATE TRIGGER update_scenario_progress_last_updated 
    BEFORE UPDATE ON scenario_progress 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create analytics_events table
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB DEFAULT '{}',
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create session_logs table for audit trail
CREATE TABLE IF NOT EXISTS session_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_session_id ON users(session_id);
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_token ON chat_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_mode ON chat_sessions(mode);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(escalation_reason);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at);

CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

CREATE INDEX IF NOT EXISTS idx_faqs_category ON faqs(category);
CREATE INDEX IF NOT EXISTS idx_faqs_carrier ON faqs(carrier_specific);
CREATE INDEX IF NOT EXISTS idx_faqs_active ON faqs(is_active);
CREATE INDEX IF NOT EXISTS idx_faqs_priority ON faqs(priority);

CREATE INDEX IF NOT EXISTS idx_escalation_tickets_session_id ON escalation_tickets(session_id);
CREATE INDEX IF NOT EXISTS idx_escalation_tickets_ticket_number ON escalation_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_escalation_tickets_status ON escalation_tickets(status);
CREATE INDEX IF NOT EXISTS idx_escalation_tickets_urgency ON escalation_tickets(urgency_level);
CREATE INDEX IF NOT EXISTS idx_escalation_tickets_created_at ON escalation_tickets(created_at);

CREATE INDEX IF NOT EXISTS idx_scenario_progress_session_token ON scenario_progress(session_token);
CREATE INDEX IF NOT EXISTS idx_scenario_progress_current_step ON scenario_progress(current_step);

CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);

CREATE INDEX IF NOT EXISTS idx_session_logs_session_id ON session_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_session_logs_action ON session_logs(action);
CREATE INDEX IF NOT EXISTS idx_session_logs_created_at ON session_logs(created_at);

-- Vector similarity search indexes (if using pgvector)
CREATE INDEX IF NOT EXISTS idx_messages_embedding 
    ON messages USING ivfflat (embedding_vector vector_cosine_ops) 
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_faqs_embedding 
    ON faqs USING ivfflat (embedding_vector vector_cosine_ops) 
    WITH (lists = 100);

-- Create views for common queries
CREATE OR REPLACE VIEW active_sessions AS
SELECT 
    cs.*,
    u.phone_number,
    u.current_carrier,
    u.target_carrier,
    u.status as user_status
FROM chat_sessions cs
JOIN users u ON cs.user_id = u.id
WHERE cs.completed_at IS NULL 
    AND cs.escalated_at IS NULL
    AND u.status = 'active';

CREATE OR REPLACE VIEW session_summary AS
SELECT 
    cs.id,
    cs.session_token,
    cs.mode,
    cs.current_step,
    u.phone_number,
    u.current_carrier,
    u.target_carrier,
    COUNT(m.id) as message_count,
    MAX(m.created_at) as last_message_at,
    cs.created_at as session_started_at,
    CASE 
        WHEN cs.completed_at IS NOT NULL THEN 'completed'
        WHEN cs.escalated_at IS NOT NULL THEN 'escalated'
        ELSE 'active'
    END as session_status
FROM chat_sessions cs
JOIN users u ON cs.user_id = u.id
LEFT JOIN messages m ON cs.id = m.session_id
GROUP BY cs.id, u.id;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO mnp_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mnp_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mnp_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO mnp_user;

-- Insert default admin user if not exists
INSERT INTO users (id, session_id, status, preferences) 
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'admin-session',
    'active',
    '{"role": "admin", "permissions": ["read", "write", "admin"]}'
) ON CONFLICT (session_id) DO NOTHING;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'MNP Chatbot database initialized successfully!';
    RAISE NOTICE 'Tables created: %, %, %, %, %, %, %, %', 
        'users', 'chat_sessions', 'messages', 'faqs', 
        'escalation_tickets', 'scenario_progress', 'analytics_events', 'session_logs';
END $$;