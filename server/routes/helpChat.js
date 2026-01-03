/**
 * Help Chat Routes
 * 
 * API routes for AI-powered help chat.
 */

import express from 'express';
const router = express.Router();
const helpChatService = import('helpChatService.js');

/**
 * POST /api/help/chat
 * Process a chat message
 */
router.post('/chat', async (req, res) => {
    try {
        const { message, context, history, language } = req.body;
        const userId = req.user?.id || 'anonymous';
        const sessionId = req.headers['x-session-id'] || `session-${Date.now()}`;
        
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Message is required' });
        }
        
        const response = await helpChatService.processMessage(message, {
            context,
            history: history || [],
            language: language || 'en'
        });
        
        // Log interaction (async, don't wait)
        helpChatService.logInteraction(userId, sessionId, message, response).catch(console.error);
        
        res.json(response);
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ 
            error: 'Failed to process message',
            message: req.body.language === 'pl' 
                ? 'Przepraszam, wystąpił błąd. Spróbuj ponownie.'
                : 'Sorry, an error occurred. Please try again.'
        });
    }
});

/**
 * GET /api/help/chat/suggestions
 * Get suggested questions based on context
 */
router.get('/chat/suggestions', async (req, res) => {
    try {
        const { context, language = 'en' } = req.query;
        
        // Context-based suggestions
        const suggestions = {
            dashboard: language === 'pl' ? [
                'Jak dostosować mój dashboard?',
                'Jakie widgety są dostępne?',
                'Jak śledzić postępy moich zadań?'
            ] : [
                'How do I customize my dashboard?',
                'What widgets are available?',
                'How do I track my task progress?'
            ],
            initiatives: language === 'pl' ? [
                'Jak stworzyć nową inicjatywę?',
                'Jak przypisać zadania do inicjatywy?',
                'Jak monitorować postępy inicjatywy?'
            ] : [
                'How do I create a new initiative?',
                'How do I assign tasks to an initiative?',
                'How do I monitor initiative progress?'
            ],
            projects: language === 'pl' ? [
                'Jak zarządzać zespołem projektu?',
                'Jak stworzyć kamienie milowe?',
                'Jak używać tablicy Kanban?'
            ] : [
                'How do I manage project team?',
                'How do I create milestones?',
                'How do I use the Kanban board?'
            ],
            admin: language === 'pl' ? [
                'Jak dodać nowego użytkownika?',
                'Jak skonfigurować uprawnienia?',
                'Jak ustawić tryb pracy organizacji?'
            ] : [
                'How do I add a new user?',
                'How do I configure permissions?',
                'How do I set organization work mode?'
            ],
            default: language === 'pl' ? [
                'Jak zacząć pracę z Consultify?',
                'Gdzie znajdę pomoc?',
                'Jak skontaktować się z supportem?'
            ] : [
                'How do I get started with Consultify?',
                'Where can I find help?',
                'How do I contact support?'
            ]
        };
        
        res.json({
            suggestions: suggestions[context] || suggestions.default
        });
    } catch (error) {
        console.error('Error fetching suggestions:', error);
        res.status(500).json({ error: 'Failed to fetch suggestions' });
    }
});

export default router;








