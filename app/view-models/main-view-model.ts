import { Observable } from '@nativescript/core';
import { OpenAIService } from '../services/openai.service';
import { RecipeService } from '../services/recipe.service';
import { VoiceService } from '../services/voice.service';
import { SpeechRecognitionService } from '../services/speech-recognition.service';

export class MainViewModel extends Observable {
    private openAIService: OpenAIService;
    private recipeService: RecipeService;
    private voiceService: VoiceService;
    private speechRecognitionService: SpeechRecognitionService;
    private retryCount: number = 0;
    private maxRetries: number = 2;

    constructor() {
        super();

        this.openAIService = new OpenAIService();
        this.recipeService = new RecipeService();
        this.voiceService = new VoiceService();
        this.speechRecognitionService = new SpeechRecognitionService();

        this.set('buttonText', 'Tap to Ask for a Recipe');
        this.set('isListening', false);
        this.set('isLoading', false);
        this.set('statusMessage', 'Tap the button and ask for a recipe!');
        this.set('recipeDetails', '');

        // Initial greeting after a short delay
        setTimeout(async () => {
            try {
                await this.voiceService.speak('Welcome! Tap the button and ask me about any recipe you\'d like to make.');
            } catch (error) {
                console.error('Initial greeting error:', error);
            }
        }, 1000);
    }

    async startConversation() {
        if (this.get('isListening')) {
            return;
        }

        try {
            this.set('isListening', true);
            this.set('buttonText', 'Listening...');
            this.set('statusMessage', 'I\'m listening... What recipe would you like to know about?');
            
            // Start listening immediately
            const transcription = await this.speechRecognitionService.startListening();
            
            if (transcription && transcription.length > 0) {
                console.log('Transcription:', transcription);
                this.set('statusMessage', 'Got it! Let me find a recipe for you...');
                this.set('isLoading', true);
                
                await this.voiceService.speak('Got it! Let me find a recipe for you.');
                
                const recipe = await this.recipeService.searchRecipes(transcription);
                const formattedRecipe = this.recipeService.formatRecipeDetails(recipe);
                
                this.set('recipeDetails', formattedRecipe);
                this.set('statusMessage', `Here's your recipe for ${recipe.title}:`);
                
                // Break down the speech into smaller chunks
                await this.voiceService.speak(`I found a great recipe for ${recipe.title}.`);
                await this.voiceService.speak('Here are the ingredients you\'ll need:');
                
                for (const ingredient of recipe.ingredients) {
                    await this.voiceService.speak(ingredient);
                }
                
                await this.voiceService.speak('Now, let me walk you through the instructions:');
                const instructions = recipe.instructions.split('\n');
                for (const instruction of instructions) {
                    await this.voiceService.speak(instruction);
                }
                
                this.retryCount = 0; // Reset retry count on success
                await this.voiceService.speak('Would you like to try another recipe? Just tap the button again!');
            } else {
                throw new Error('No speech detected');
            }

        } catch (error) {
            console.error('Error:', error);
            
            if (error.message === 'No speech detected' && this.retryCount < this.maxRetries) {
                this.retryCount++;
                this.set('statusMessage', 'I couldn\'t hear that clearly. Please try again.');
                await this.voiceService.speak('I couldn\'t hear that clearly. Please try again.');
                await this.startConversation();
                return;
            } else {
                this.set('statusMessage', 'I\'m having trouble hearing you. Please check your microphone and try again.');
                await this.voiceService.speak('I\'m having trouble hearing you. Please check your microphone and try again.');
                this.retryCount = 0;
            }
        } finally {
            this.set('isListening', false);
            this.set('buttonText', 'Tap to Ask for a Recipe');
            this.set('isLoading', false);
        }
    }
}