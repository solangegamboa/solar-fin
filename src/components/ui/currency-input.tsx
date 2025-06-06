
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
interface CurrencyInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'>, RHFInputProps {}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value: rhfValue, name, onBlur: rhfOnBlur, onChange: rhfOnChange, className, ...rest }, ref) => {

    const handleValueChange = (values: NumberFormatValues) => {
      if (rhfOnChange) {
        // Pass floatValue (which is number | undefined) or null if it's undefined.
        // RHF typically handles undefined or null for empty values.
        rhfOnChange(values.floatValue === undefined ? null : values.floatValue);
      }
    };

    // Determine the value to pass to NumericFormat.
    // If RHF value is null, undefined, or an empty string, pass an empty string to NumericFormat.
    // NumericFormat's `value` prop can accept string, number, or null.
    // Using an empty string for "empty" state can sometimes be more stable for masked inputs.
    const valueForNumericFormat =
      (rhfValue === null || rhfValue === undefined || String(rhfValue).trim() === '')
      ? '' // Use empty string for empty/null/undefined RHF values
      : Number(rhfValue); // Ensure it's a number if it has a value, NumericFormat can handle numbers

    return (
      <NumericFormat
        {...rest} // Passes placeholder, disabled, etc.
        name={name} // Pass name for RHF
        getInputRef={ref} // Pass ref to NumericFormat
        customInput={React.forwardRef((props, inputRef) => (
          <Input {...props} ref={inputRef as React.Ref<HTMLInputElement>} className={cn("text-base md:text-sm", className)} />
        ))}
        value={valueForNumericFormat} // Use the potentially empty string or number
        onValueChange={handleValueChange}
        onBlur={rhfOnBlur} // Pass RHF's onBlur
        thousandSeparator="."
        decimalSeparator=","
        prefix="R$ "
        decimalScale={2}
        fixedDecimalScale
        allowNegative={false}
        type="text" // Masked inputs should be type="text" for proper behavior
        autoComplete="off"
      />
    );
  }
);
CurrencyInput.displayName = 'CurrencyInput';

export { CurrencyInput };
