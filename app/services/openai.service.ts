import { Http } from '@nativescript/core';
import { API_CONFIG } from '../config/api.config';

export class OpenAIService {
    private apiKey: string;
    private apiUrl = 'https://api.openai.com/v1/chat/completions';

    constructor() {
        this.apiKey = API_CONFIG.OPENAI_API_KEY;
    }

    async getCompletion(prompt: string): Promise<string> {
        try {
            if (!this.apiKey) {
                throw new Error('OpenAI API key is not set');
            }

            const response = await Http.request({
                url: this.apiUrl,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                content: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a helpful cooking assistant. Provide detailed, clear recipes with exact measurements and step-by-step instructions.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ]
                })
            });

            if (response.statusCode !== 200) {
                throw new Error('Failed to get response from OpenAI');
            }

            const data = response.content.toJSON();
            return data.choices[0].message.content;
        } catch (error) {
            console.error('OpenAI error:', error);
            throw new Error('OpenAI API error');
        }
    }
}