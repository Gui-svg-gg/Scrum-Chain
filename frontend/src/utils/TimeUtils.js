export class TimeUtils {
  /**
   * @param {string} timeString 
   * @returns {number} 
   */
  static timeToMinutes(timeString) {
    if (!timeString || timeString === '' || timeString === '00:00') {
      return 0;
    }
    
    const parts = timeString.split(':');
    if (parts.length !== 2) {
      console.warn(`⚠️ TimeUtils: Formato de tempo inválido: "${timeString}". Usando 0 minutos.`);
      return 0;
    }
    
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    
    if (hours < 0 || minutes < 0 || minutes >= 60) {
      console.warn(`⚠️ TimeUtils: Tempo inválido: "${timeString}". Usando 0 minutos.`);
      return 0;
    }
    
    return hours * 60 + minutes;
  }
  
  /**
   * @param {number} minutes 
   * @returns {string} 
   */
  static minutesToTime(minutes) {
    if (!minutes || minutes <= 0) {
      return '00:00';
    }
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
  
  /**
   * @param {number} hours 
   * @returns {number} 
   */
  static hoursToMinutes(hours) {
    if (!hours || hours <= 0) {
      return 0;
    }
    return Math.round(hours * 60);
  }
  
  /**
   * @param {number} minutes 
   * @returns {number} 
   */
  static minutesToHours(minutes) {
    if (!minutes || minutes <= 0) {
      return 0;
    }
    return minutes / 60;
  }
  
  /**
   * @param {number} minutes 
   * @returns {string} 
   */
  static formatTimeDisplay(minutes) {
    if (!minutes || minutes <= 0) {
      return '0h 0min';
    }
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) {
      return `${mins}min`;
    }
    if (mins === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${mins}min`;
  }
  
  /**
   * @param {string} timeString 
   * @returns {boolean} 
   */
  static isValidTimeFormat(timeString) {
    if (!timeString || typeof timeString !== 'string') {
      return false;
    }
    
    const timeRegex = /^(\d{1,2}):([0-5]\d)$/;
    const match = timeString.match(timeRegex);
    
    if (!match) {
      return false;
    }
    
    const hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    
    return hours >= 0 && minutes >= 0 && minutes < 60;
  }
  
  /**
   * @param {string|number} input 
   * @param {string} inputType
   * @returns {number} 
   */
  static parseTimeInput(input, inputType = 'time') {
    if (!input) return 0;
    
    switch (inputType) {
      case 'time':
        if (typeof input === 'string' && input.includes(':')) {
          return this.timeToMinutes(input);
        }

        return this.hoursToMinutes(parseFloat(input) || 0);
        
      case 'hours':
        return this.hoursToMinutes(parseFloat(input) || 0);
        
      case 'minutes':
        return parseInt(input) || 0;
        
      default:
        return this.timeToMinutes(input);
    }
  }
  
  /**
   * @param {any} input 
   * @returns {number} 
   */
  static normalizeToMinutes(input) {
    if (!input) return 0;
    
    if (typeof input === 'number') {
      return Math.max(0, Math.round(input));
    }
    
    if (typeof input === 'string') {
      if (input.includes(':')) {
        return this.timeToMinutes(input);
      }

      const numValue = parseFloat(input);
      if (!isNaN(numValue)) {
        return this.hoursToMinutes(numValue);
      }
    }
    
    return 0;
  }
  
  /**
   * @param {number} backendMinutes 
   * @returns {string} 
   */
  static fromBackend(backendMinutes) {
    return this.minutesToTime(backendMinutes || 0);
  }
  
  /**
   * @param {string} frontendTime 
   * @returns {number} 
   */
  static toBackend(frontendTime) {
    return this.timeToMinutes(frontendTime || '00:00');
  }
}

export default TimeUtils;