import { TimeUtils } from '../utils/TimeUtils';


console.log('🧪 TESTANDO TimeUtils no frontend:');

const testCases = [
  '02:30',
  '01:15', 
  '00:45',
  '12:00',
  ''  
];

testCases.forEach(time => {
  console.log(`"${time}" →`, {
    toBackend: TimeUtils.toBackend(time),
    formatDisplay: TimeUtils.formatTimeDisplay(TimeUtils.toBackend(time)),
    isValid: TimeUtils.isValidTimeFormat(time)
  });
});


const formDataExample = { estimatedHours: '02:30' };
console.log('📋 Teste específico do form:');
console.log('formData.estimatedHours:', formDataExample.estimatedHours);
console.log('TimeUtils.toBackend():', TimeUtils.toBackend(formDataExample.estimatedHours));
console.log('TimeUtils.formatTimeDisplay():', TimeUtils.formatTimeDisplay(TimeUtils.toBackend(formDataExample.estimatedHours)));

export {};