
"use client";

import * as React from 'react';
import { NumericFormat, type NumberFormatValues, type SourceInfo } from 'react-number-format';
import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CurrencyInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'> {
  value?: string | number | null | undefined;
  onChange?: (value: number | null) => void; 
  onBlur?: () => void;
  name?: string;
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value: rhfValue, onChange: rhfOnChange, onBlur: rhfOnBlur, name, className, ...rest }, ref) => {

    const handleNumericFormatValueChange = (values: NumberFormatValues, sourceInfo: SourceInfo) => {
      if (rhfOnChange && sourceInfo.source === 'event') { // Only update on user event to prevent cycles
        let valToPass: number | null;
        // Ensure floatValue is a valid number; otherwise, pass null.
        // This handles cases where floatValue might be undefined or NaN.
        if (typeof values.floatValue === 'number' && !isNaN(values.floatValue)) {
          valToPass = values.floatValue;
        } else {
          valToPass = null;
        }
        rhfOnChange(valToPass);
      }
    };

    // Determine the value to pass to NumericFormat.
    // NumericFormat can handle undefined for its value prop (treats as empty).
    // If rhfValue is null or undefined, pass undefined. Otherwise, ensure it's a number.
    const valueForNumericFormat = (rhfValue === null || rhfValue === undefined)
      ? undefined 
      : Number(rhfValue); 

    return (
      <NumericFormat
        {...rest} 
        name={name} 
        getInputRef={ref} 
        customInput={React.forwardRef((props, inputRef) => (
          // Ensure customInput also gets className for consistent styling
          <Input {...props} ref={inputRef as React.Ref<HTMLInputElement>} className={cn("text-base md:text-sm", className)} />
        ))}
        value={valueForNumericFormat}
        onValueChange={handleNumericFormatValueChange}
        onBlur={rhfOnBlur} 
        thousandSeparator="."
        decimalSeparator=","
        prefix="R$ "
        decimalScale={2}
        fixedDecimalScale
        allowNegative={false}
        type="text" 
        autoComplete="off"
      />
    );
  }
);
CurrencyInput.displayName = 'CurrencyInput';

export { CurrencyInput };
