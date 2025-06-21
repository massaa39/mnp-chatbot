-- FAQ∆¸÷Î\
-- Purpose:  Ï√∏Ÿ¸π°hRAG"˛a
CREATE TABLE faqs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(50) NOT NULL,
    subcategory VARCHAR(50),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    keywords TEXT[],
    embedding_vector FLOAT8[],
    priority INTEGER DEFAULT 1,
    carrier_specific VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- §Û«√Øπ\
CREATE INDEX idx_faqs_category ON faqs(category);
CREATE INDEX idx_faqs_carrier_specific ON faqs(carrier_specific);
CREATE INDEX idx_faqs_is_active ON faqs(is_active);
CREATE INDEX idx_faqs_priority ON faqs(priority);

-- GIN§Û«√ØπM"(	
CREATE INDEX idx_faqs_keywords ON faqs USING GIN (keywords);

-- há"§Û«√Øπ
CREATE INDEX idx_faqs_fulltext ON faqs USING GIN (
    to_tsvector('japanese', question || ' ' || answer)
);

-- Ù∞B;Í’Ù∞»Í¨¸
CREATE TRIGGER update_faqs_updated_at 
    BEFORE UPDATE ON faqs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();