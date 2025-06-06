
"use client";

import * as React from 'react';
import { NumericFormat, type NumberFormatValues } from 'react-number-format';
import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Props that will be passed by react-hook-form's `field` object
interface RHFInputProps {
  value?: string | number | null;
  onChange?: (eventOrValue: any) => void; // RHF's onChange can take event or value
  onBlur?: () => void;
  name?: string;
  ref?: React.Ref<HTMLInputElement>;
}

// Combine RHF props with other standard input props, but exclude ones NumericFormat handles differently
interface CurrencyInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'>, RHFInputProps {
  // Custom prop to bridge RHF's onChange with NumericFormat's onValueChange behavior
  // RHF's field.onChange expects the raw numeric value (or undefined/null for empty)
  onValueChangeNumeric?: (value: number | undefined) => void;
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, name, onBlur, onValueChangeNumeric, className, ...rest }, ref) => {
    
    const handleValueChange = (values: NumberFormatValues) => {
      if (onValueChangeNumeric) {
        onValueChangeNumeric(values.floatValue);
      }
    };

    // NumericFormat expects 'value' as string or number.
    // If RHF field.value is null/undefined (empty), pass undefined to NumericFormat to show placeholder.
    // Otherwise, ensure it's a number.
    const numericValue = (value === null || value === undefined || value === '') ? undefined : Number(value);

    return (
      <NumericFormat
        {...rest} // Passes placeholder, disabled, etc.
        name={name} // Pass name for RHF
        getInputRef={ref} // Pass ref to NumericFormat
        customInput={React.forwardRef((props, inputRef) => (
          <Input {...props} ref={inputRef as React.Ref<HTMLInputElement>} className={cn("text-base md:text-sm", className)} />
        ))}
        value={numericValue}
        onValueChange={handleValueChange}
        onBlur={onBlur} // Pass onBlur for RHF
        thousandSeparator="."
        decimalSeparator=","
        prefix="R$ "
        decimalScale={2}
        fixedDecimalScale
        allowNegative={false} // Most financial inputs are for positive amounts; type (income/expense) handles sign
        type="text" // Masked inputs should be type="text" for proper behavior
        autoComplete="off"
      />
    );
  }
);
CurrencyInput.displayName = 'CurrencyInput';

export { CurrencyInput };
