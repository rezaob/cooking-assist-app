import { Http } from '@nativescript/core';
import { API_CONFIG } from '../config/api.config';

export interface Recipe {
    title: string;
    instructions: string;
    ingredients: string[];
    preparationTime: string;
    servings: number;
}

export class RecipeService {
    private apiKey: string;
    private apiUrl = 'https://api.openai.com/v1/chat/completions';

    constructor() {
        this.apiKey = API_CONFIG.OPENAI_API_KEY;
    }

    async searchRecipes(query: string): Promise<Recipe> {
        try {
            const prompt = `Create a detailed recipe based on this request: "${query}". 
                          Format the response in this exact structure:
                          Title: [recipe name]
                          Preparation Time: [time]
                          Servings: [number]
                          Ingredients:
                          - [ingredient 1]
                          - [ingredient 2]
                          Instructions:
                          1. [step 1]
                          2. [step 2]`;

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
                            content: 'You are a helpful cooking assistant. Provide detailed recipes with exact measurements.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 800
                })
            });

            if (response.statusCode !== 200) {
                throw new Error('Failed to get recipe from OpenAI');
            }

            const data = response.content.toJSON();
            const recipeText = data.choices[0].message.content;
            return this.parseRecipeFromResponse(recipeText);
        } catch (error) {
            console.error('Recipe search error:', error);
            throw new Error('Failed to generate recipe');
        }
    }

    private parseRecipeFromResponse(response: string): Recipe {
        const lines = response.split('\n');
        let title = '';
        let preparationTime = '30 minutes';
        let servings = 4;
        let ingredients: string[] = [];
        let instructions = '';
        let currentSection = '';

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('Title:')) {
                title = trimmedLine.replace('Title:', '').trim();
            } else if (trimmedLine.startsWith('Preparation Time:')) {
                preparationTime = trimmedLine.replace('Preparation Time:', '').trim();
            } else if (trimmedLine.startsWith('Servings:')) {
                servings = parseInt(trimmedLine.replace('Servings:', '').trim(), 10) || 4;
            } else if (trimmedLine === 'Ingredients:') {
                currentSection = 'ingredients';
            } else if (trimmedLine === 'Instructions:') {
                currentSection = 'instructions';
            } else if (trimmedLine.startsWith('-') && currentSection === 'ingredients') {
                ingredients.push(trimmedLine.replace('-', '').trim());
            } else if (/^\d+\./.test(trimmedLine) && currentSection === 'instructions') {
                instructions += trimmedLine + '\n';
            }
        }

        return {
            title,
            ingredients,
            instructions: instructions.trim(),
            preparationTime,
            servings
        };
    }

    formatRecipeDetails(recipe: Recipe): string {
        return `
🍳 ${recipe.title.toUpperCase()} 🍳

⏱️ Preparation Time: ${recipe.preparationTime}
👥 Servings: ${recipe.servings}

📝 INGREDIENTS:
${recipe.ingredients.map(ing => `• ${ing}`).join('\n')}

📋 INSTRUCTIONS:
${recipe.instructions}

Bon Appétit! 🎉
        `.trim();
    }
}