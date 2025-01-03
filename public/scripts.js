// public/scripts.js
document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.querySelector('.generate-btn');
    const visionInput = document.querySelector('.vision-input');
    const promptsContainer = document.querySelector('.prompts-container');
    const loader = document.querySelector('.loader');
  
    // Map for organizing prompts by category
    const categoryRanges = {
      'portraits-grid': { start: 1, end: 5 },
      'establishing-grid': { start: 6, end: 9 },
      'editorial-grid': { start: 10, end: 19 },
      'closeup-grid': { start: 20, end: 31 },
      'macro-grid': { start: 32, end: 35 },
      'contextual-grid': { start: 36, end: 49 }
    };
  
    function showError(message) {
      console.error('Error occurred:', message);
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error-message';
      errorDiv.textContent = message;
      promptsContainer.insertBefore(errorDiv, promptsContainer.firstChild);
      promptsContainer.style.display = 'block';
    }
  
    function createPromptBox(prompt) {
      console.log('Creating prompt box for:', prompt);
      const div = document.createElement('div');
      div.className = 'prompt-box';
      
      div.innerHTML = `
        <div class="prompt-header">
          <span>Image #${prompt.imageNumber} (${prompt.imageRatio})</span>
          <button class="copy-btn" onclick="navigator.clipboard.writeText(this.parentElement.nextElementSibling.value)">
            Copy
          </button>
        </div>
        <textarea class="prompt-textarea" rows="4">${prompt.imagePrompt}</textarea>
      `;
      
      return div;
    }
  
    function displayPrompts(prompts) {
      console.log('Displaying prompts:', prompts);
      
      // Clear any existing error messages
      const existingErrors = document.querySelectorAll('.error-message');
      existingErrors.forEach(error => error.remove());
  
      // Sort prompts by image number
      prompts.sort((a, b) => a.imageNumber - b.imageNumber);
      console.log('Sorted prompts:', prompts);
  
      // Clear existing prompts
      Object.keys(categoryRanges).forEach(gridId => {
        const grid = document.getElementById(gridId);
        if (grid) grid.innerHTML = '';
      });
  
      // Distribute prompts to appropriate grids
      prompts.forEach(prompt => {
        const promptNumber = prompt.imageNumber;
        let targetGridId = null;
  
        // Find the appropriate grid based on prompt number
        for (const [gridId, range] of Object.entries(categoryRanges)) {
          if (promptNumber >= range.start && promptNumber <= range.end) {
            targetGridId = gridId;
            break;
          }
        }
  
        console.log(`Prompt #${promptNumber} assigned to grid: ${targetGridId}`);
  
        if (targetGridId) {
          const grid = document.getElementById(targetGridId);
          if (grid) {
            grid.appendChild(createPromptBox(prompt));
          } else {
            console.warn(`Grid not found for ID: ${targetGridId}`);
          }
        } else {
          console.warn(`No matching grid found for prompt #${promptNumber}`);
        }
      });
  
      // Show the prompts container
      promptsContainer.style.display = 'flex';
    }
  
    async function generatePrompts() {
      const prompt = visionInput.value.trim();
      console.log('Starting prompt generation with input:', prompt);
      
      if (!prompt) {
        showError('Please enter your vision first!');
        return;
      }
  
      // Show loading state
      generateBtn.disabled = true;
      loader.style.display = 'block';
      promptsContainer.style.display = 'none';
  
      try {
        console.log('Sending API request...');
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt }),
        });
  
        console.log('API Response status:', response.status);
        const data = await response.json();
        console.log('API Response data:', data);
  
        if (!response.ok) {
          throw new Error(data.message || 'Failed to generate prompts');
        }
  
        if (data.message) {
          showError(data.message);
          return;
        }
  
        // Log specific data validation
        if (Array.isArray(data)) {
          console.log('Number of prompts received:', data.length);
          console.log('Sample prompt structure:', data[0]);
        } else {
          console.warn('Unexpected data structure:', data);
        }
  
        displayPrompts(data);
  
      } catch (error) {
        console.error('Error in generatePrompts:', error);
        showError(error.message || 'Failed to generate prompts. Please try again.');
      } finally {
        generateBtn.disabled = false;
        loader.style.display = 'none';
      }
    }
  
    // Event Listeners
    generateBtn.addEventListener('click', () => {
      console.log('Generate button clicked');
      generatePrompts();
    });
    
    visionInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter' && event.shiftKey) {
        event.preventDefault();
        generatePrompts();
      }
    });
  
    // Log initial setup completion
    console.log('Script initialized successfully');
  });