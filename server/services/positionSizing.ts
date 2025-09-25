import { coindcxService } from './coindcx.js';

export interface PositionSizeInput {
  entry: number;
  stopLoss: number;
  fund: number;
  riskPct: number;
  pair: string;
}

export interface PositionSizeResult {
  qty: number;
  leverage: number;
  meta: {
    stepSize: number;
    minQty: number;
    maxLeverage: number;
    minNotional: number;
  };
  warnings: string[];
  notional: number;
  requiredMargin: number;
}

export interface PositionSizeError {
  success: false;
  error: string;
  reason: 'insufficient_funds' | 'invalid_parameters' | 'metadata_unavailable' | 'position_too_small';
}

/**
 * Central position sizing utility for futures trading
 * Handles step size compliance and integer leverage calculation
 */
export class PositionSizingService {
  
  /**
   * Calculate position size with exchange compliance
   */
  async sizePosition(input: PositionSizeInput): Promise<PositionSizeResult | PositionSizeError> {
    try {
      const { entry, stopLoss, fund, riskPct, pair } = input;
      
      // Input validation
      if (!this.validateInputs(input)) {
        return {
          success: false,
          error: 'Invalid parameters provided',
          reason: 'invalid_parameters'
        };
      }

      // Step 1: Basic risk calculation
      const riskAmount = fund * (riskPct / 100);
      const perUnitRisk = Math.abs(entry - stopLoss);
      
      if (perUnitRisk === 0) {
        return {
          success: false,
          error: 'Entry price and stop loss cannot be the same',
          reason: 'invalid_parameters'
        };
      }
      
      const rawQty = riskAmount / perUnitRisk;

      // Step 2: Fetch exchange metadata
      const meta = await coindcxService.getFuturesInstrumentMeta(pair);
      
      // Detect unreliable metadata (fallback defaults)
      if (this.isDefaultMetadata(meta, pair)) {
        return {
          success: false,
          error: `Market metadata unavailable for ${pair}. Please try again later.`,
          reason: 'metadata_unavailable'
        };
      }
      
      // Step 3: Round quantity to step size
      let qty = this.roundDownToStep(rawQty, meta.stepSize);
      
      // Ensure minimum quantity with step size compliance
      if (qty < meta.minQty) {
        qty = this.ceilToStep(meta.minQty, meta.stepSize);
      }

      // Step 4: Calculate leverage (natural calculation without artificial limits)
      const notional = qty * entry;
      let requiredLev = Math.ceil(notional / fund); // Round up to whole number
      
      const warnings: string[] = [];
      
      // Log leverage info but don't artificially limit it
      if (requiredLev > meta.maxLeverage) {
        warnings.push(`High leverage ${requiredLev}x may be rejected by exchange (max: ${meta.maxLeverage}x)`);
      }
      
      // Ensure leverage is at least 1x
      if (requiredLev < 1) {
        requiredLev = 1;
      }
      
      const finalNotional = qty * entry;
      const requiredMargin = finalNotional / requiredLev;
      
      // Final validation
      if (finalNotional < meta.minNotional) {
        return {
          success: false,
          error: `Position too small: Notional ${finalNotional} < minimum ${meta.minNotional}`,
          reason: 'position_too_small'
        };
      }
      
      if (requiredMargin > fund) {
        return {
          success: false,
          error: `Insufficient margin: Required ${requiredMargin} > Available ${fund}`,
          reason: 'insufficient_funds'
        };
      }
      
      console.log(`   - Notional Value: ${finalNotional} USDT`);
      console.log(`   - Required Leverage: ${requiredLev}x`);
      console.log(`   - Required Margin: ${requiredMargin} USDT`);
      console.log(`   - Warnings: ${warnings.length}`);
      
      return {
        qty,
        leverage: requiredLev,
        meta: {
          stepSize: meta.stepSize,
          minQty: meta.minQty,
          maxLeverage: meta.maxLeverage,
          minNotional: meta.minNotional
        },
        warnings,
        notional: finalNotional,
        requiredMargin
      };
      
    } catch (error: any) {
      console.error(`❌ Position sizing failed for ${input.pair}:`, error.message);
      return {
        success: false,
        error: `Position sizing failed: ${error.message}`,
        reason: 'metadata_unavailable'
      };
    }
  }
  
  /**
   * Round down to nearest step size multiple (precision-safe)
   */
  private roundDownToStep(value: number, stepSize: number): number {
    return this.floorToStep(value, stepSize);
  }
  
  /**
   * Round up to nearest step size multiple (precision-safe)
   */
  private ceilToStep(value: number, stepSize: number): number {
    const decimals = this.getDecimals(stepSize);
    const factor = Math.pow(10, decimals);
    const scaledValue = Math.round(value * factor);
    const scaledStep = Math.round(stepSize * factor);
    const roundedValue = Math.ceil(scaledValue / scaledStep) * scaledStep;
    return roundedValue / factor;
  }
  
  /**
   * Round down to nearest step size multiple (precision-safe)
   */
  private floorToStep(value: number, stepSize: number): number {
    const decimals = this.getDecimals(stepSize);
    const factor = Math.pow(10, decimals);
    const scaledValue = Math.round(value * factor);
    const scaledStep = Math.round(stepSize * factor);
    const roundedValue = Math.floor(scaledValue / scaledStep) * scaledStep;
    return roundedValue / factor;
  }
  
  /**
   * Get number of decimal places in a number
   */
  private getDecimals(value: number): number {
    if (Math.floor(value) === value) return 0;
    const str = value.toString();
    if (str.indexOf('.') !== -1 && str.indexOf('e-') === -1) {
      return str.split('.')[1].length;
    } else if (str.indexOf('e-') !== -1) {
      const parts = str.split('e-');
      return parseInt(parts[1], 10);
    }
    return 0;
  }
  
  /**
   * Check if metadata looks like fallback defaults
   */
  private isDefaultMetadata(meta: any, pair: string): boolean {
    // Detect common fallback patterns for USDT pairs
    if (pair.includes('USDT') && meta.stepSize >= 1 && meta.minQty === 1 && meta.maxLeverage === 1) {
      console.log(`⚠️ Detected default/fallback metadata for ${pair}`);
      return true;
    }
    return false;
  }
  
  /**
   * Validate input parameters
   */
  private validateInputs(input: PositionSizeInput): boolean {
    const { entry, stopLoss, fund, riskPct, pair } = input;
    
    if (!pair || pair.length === 0) {
      console.error('❌ Invalid pair');
      return false;
    }
    
    if (entry <= 0) {
      console.error('❌ Entry price must be greater than 0');
      return false;
    }
    
    if (stopLoss <= 0) {
      console.error('❌ Stop loss must be greater than 0');
      return false;
    }
    
    if (fund <= 0) {
      console.error('❌ Fund must be greater than 0');
      return false;
    }
    
    if (riskPct <= 0 || riskPct > 100) {
      console.error('❌ Risk percent must be between 0 and 100');
      return false;
    }
    
    return true;
  }
}

// Export singleton instance
export const positionSizingService = new PositionSizingService();