import { Injectable, OnModuleInit } from '@nestjs/common';
import nspell from 'nspell';
import { CheckSpellDto, SpellError } from './dto/check-spell.dto';

@Injectable()
export class SpellCheckService implements OnModuleInit {
  private spell: any = null;

  async onModuleInit() {
    try {
      // dictionary-vi version 3.0.0 export trực tiếp object {aff, dic}
      const dictionaryModule = await import('dictionary-vi');
      const dict = (dictionaryModule as any).default || dictionaryModule;
      
      // dict là object {aff: Uint8Array, dic: Uint8Array}
      this.spell = nspell(dict);
    } catch (error) {
      console.error('Lỗi import dictionary:', error);
      throw error;
    }
  }

  // Hàm tính khoảng cách Levenshtein (để so sánh độ tương đồng)
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  // Tạo biến thể dấu cho nhiều ký tự (thay thế nhiều vị trí)
  private generateMultipleAccentVariations(word: string, maxVariations: number = 50): string[] {
    const variations = new Set<string>([word]);
    const accentMap: { [key: string]: string[] } = {
      'o': ['ò', 'ó', 'ọ', 'ỏ', 'õ', 'ô', 'ồ', 'ố', 'ộ', 'ổ', 'ỗ', 'ơ', 'ờ', 'ớ', 'ợ', 'ở', 'ỡ'],
      'i': ['ì', 'í', 'ị', 'ỉ', 'ĩ'],
      'a': ['à', 'á', 'ạ', 'ả', 'ã', 'â', 'ầ', 'ấ', 'ậ', 'ẩ', 'ẫ', 'ă', 'ằ', 'ắ', 'ặ', 'ẳ', 'ẵ'],
      'e': ['è', 'é', 'ẹ', 'ẻ', 'ẽ', 'ê', 'ề', 'ế', 'ệ', 'ể', 'ễ'],
      'u': ['ù', 'ú', 'ụ', 'ủ', 'ũ', 'ư', 'ừ', 'ứ', 'ự', 'ử', 'ữ'],
      'y': ['ỳ', 'ý', 'ỵ', 'ỷ', 'ỹ'],
    };

    // Tìm các vị trí có thể thay đổi dấu
    const positions: number[] = [];
    for (let i = 0; i < word.length; i++) {
      const char = word[i].toLowerCase();
      const baseChar = char.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (accentMap[baseChar]) {
        positions.push(i);
      }
    }

    // Tạo biến thể bằng cách thay thế từng vị trí
    for (const pos of positions) {
      if (variations.size >= maxVariations) break;
      
      const char = word[pos].toLowerCase();
      const baseChar = char.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      
      if (accentMap[baseChar]) {
        for (const accented of accentMap[baseChar]) {
          if (variations.size >= maxVariations) break;
          
          const replacement = word[pos] === word[pos].toUpperCase() 
            ? accented.toUpperCase() 
            : accented;
          const newWord = word.substring(0, pos) + replacement + word.substring(pos + 1);
          variations.add(newWord);
        }
      }
    }

    // Thử thay thế 2 vị trí (nếu chưa đủ)
    if (variations.size < maxVariations && positions.length >= 2) {
      for (let i = 0; i < positions.length - 1 && variations.size < maxVariations; i++) {
        for (let j = i + 1; j < positions.length && variations.size < maxVariations; j++) {
          const pos1 = positions[i];
          const pos2 = positions[j];
          
          const char1 = word[pos1].toLowerCase();
          const char2 = word[pos2].toLowerCase();
          const baseChar1 = char1.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const baseChar2 = char2.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          
          if (accentMap[baseChar1] && accentMap[baseChar2]) {
            for (const acc1 of accentMap[baseChar1].slice(0, 3)) {
              if (variations.size >= maxVariations) break;
              
              for (const acc2 of accentMap[baseChar2].slice(0, 3)) {
                if (variations.size >= maxVariations) break;
                
                const rep1 = word[pos1] === word[pos1].toUpperCase() ? acc1.toUpperCase() : acc1;
                const rep2 = word[pos2] === word[pos2].toUpperCase() ? acc2.toUpperCase() : acc2;
                
                let newWord = word.substring(0, pos1) + rep1 + word.substring(pos1 + 1);
                newWord = newWord.substring(0, pos2) + rep2 + newWord.substring(pos2 + 1);
                variations.add(newWord);
              }
            }
          }
        }
      }
    }

    return Array.from(variations);
  }

  // Cải thiện suggestions bằng cách tìm từ gần nhất tự động
  private improveSuggestions(originalWord: string, rawSuggestions: string[]): string[] {
    const improved = new Set<string>();
    
    // Giữ suggestions gốc từ nspell
    rawSuggestions.forEach(s => improved.add(s));
    
    // Tạo nhiều biến thể dấu hơn (bao gồm thay thế nhiều vị trí)
    const variations = this.generateMultipleAccentVariations(originalWord, 100);
    
    // Kiểm tra từng biến thể có trong dictionary không
    for (const variant of variations) {
      if (variant !== originalWord && this.spell.correct(variant.toLowerCase())) {
        improved.add(variant);
      }
    }
    
    // Sắp xếp theo độ tương đồng (Levenshtein distance)
    const sorted = Array.from(improved).sort((a, b) => {
      const distA = this.levenshteinDistance(originalWord.toLowerCase(), a.toLowerCase());
      const distB = this.levenshteinDistance(originalWord.toLowerCase(), b.toLowerCase());
      
      // Ưu tiên từ có cùng độ dài
      if (a.length === originalWord.length && b.length !== originalWord.length) return -1;
      if (b.length === originalWord.length && a.length !== originalWord.length) return 1;
      
      // Ưu tiên từ có cùng prefix (2-3 ký tự đầu)
      const prefixLen = Math.min(2, originalWord.length);
      const prefixA = a.substring(0, prefixLen).toLowerCase();
      const prefixB = b.substring(0, prefixLen).toLowerCase();
      const prefixOrig = originalWord.substring(0, prefixLen).toLowerCase();
      
      if (prefixA === prefixOrig && prefixB !== prefixOrig) return -1;
      if (prefixB === prefixOrig && prefixA !== prefixOrig) return 1;
      
      return distA - distB;
    });
    
    return sorted.slice(0, 5);
  }

  async checkText(dto: CheckSpellDto): Promise<{ original: string; errors: SpellError[] }> {
    if (!this.spell) {
      throw new Error('Dictionary chưa được load');
    }

    const { text } = dto;
    const errors: SpellError[] = [];
    
    // Tách text thành từ (giữ dấu tiếng Việt)
    const words = text.match(/[\p{L}\p{N}]+/gu) || [];
    
    let currentOffset = 0;
    
    for (const word of words) {
      const wordLower = word.toLowerCase();
      
      // Bỏ qua số và từ quá ngắn
      if (word.length < 2 || /^\d+$/.test(word)) {
        continue;
      }
      
      // Kiểm tra từ sai chính tả
      if (!this.spell.correct(wordLower)) {
        // Lấy suggestions từ nspell
        const rawSuggestions = this.spell.suggest(wordLower);
        
        // Cải thiện suggestions
        const suggestions = this.improveSuggestions(word, rawSuggestions);
        
        // Tìm vị trí của từ trong text
        const wordIndex = text.indexOf(word, currentOffset);
        
        errors.push({
          word,
          offset: wordIndex >= 0 ? wordIndex : currentOffset,
          length: word.length,
          suggestions,
        });
        
        if (wordIndex >= 0) {
          currentOffset = wordIndex + word.length;
        }
      }
    }

    return {
      original: text,
      errors,
    };
  }
}