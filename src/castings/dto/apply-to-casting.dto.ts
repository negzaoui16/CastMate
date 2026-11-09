import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApplyToCastingDto {
  @ApiProperty({
    description: 'Feedback IA généré côté frontend (JSON string)',
    required: false,
    example: JSON.stringify({
      globalScore: 75,
      emotions: { detected: ['joie'], coherence: 80, intensity: 70, comment: 'Bien exprimé' },
      posture: { score: 70, strengths: ['Bonne posture'], improvements: [], comment: 'Correct' },
      intonation: { score: 75, clarity: 80, rhythm: 70, expressiveness: 75, comment: 'Bon' },
      expressivite: { score: 80, facialExpressions: 'Expressif', bodyLanguage: 'Naturel', comment: 'Très bien' },
      recommendations: ['Varier le ton'],
      strengths: ['Bonne diction'],
      summary: 'Performance solide',
    }),
  })
  @IsOptional()
  @IsString()
  aiFeedback?: string;
}

