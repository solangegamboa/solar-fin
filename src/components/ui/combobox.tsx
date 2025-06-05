
"use client"

import * as React from "react"
import { Check, ChevronsUpDown, PlusCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useToast } from "@/hooks/use-toast"
import type { UserCategory } from "@/types" // Assuming UserCategory has { id: string, name: string }

interface ComboboxProps {
  items: UserCategory[];
  value: string; // The current selected category name
  onChange: (value: string) => void; // Returns the category name
  onAddNewCategory: (categoryName: string) => Promise<UserCategory | null>;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
}

export function Combobox({
  items,
  value,
  onChange,
  onAddNewCategory,
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar ou criar...",
  emptyMessage = "Nenhuma categoria encontrada.",
  disabled = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")
  const { toast } = useToast()
  const [isAdding, setIsAdding] = React.useState(false);

  const handleSelect = (currentValue: string) => {
    const selectedItem = items.find(
      (item) => item.name.toLowerCase() === currentValue.toLowerCase()
    )
    if (selectedItem) {
      onChange(selectedItem.name) // Return the exact name casing from items
    } else {
      onChange(currentValue) // Fallback, should ideally be from items or newly added
    }
    setOpen(false)
    setInputValue("")
  }

  const handleAddNew = async () => {
    if (!inputValue.trim()) {
      toast({ variant: "destructive", title: "Nome Inválido", description: "O nome da categoria não pode ser vazio." });
      return;
    }
    setIsAdding(true);
    try {
      const newCategory = await onAddNewCategory(inputValue.trim());
      if (newCategory) {
        toast({ title: "Sucesso", description: `Categoria "${newCategory.name}" adicionada.` });
        onChange(newCategory.name); // Select the newly added category
        setOpen(false);
        setInputValue("");
      } else {
        // Error toast should be handled by onAddNewCategory if it returns null due to an error
        // Or if it means "already exists but couldn't retrieve", we might need more specific handling
      }
    } catch (error) {
      // This catch is a fallback, actual errors should be handled in onAddNewCategory
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível adicionar a categoria." });
    } finally {
      setIsAdding(false);
    }
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(inputValue.toLowerCase())
  );

  const showAddNewOption = inputValue.trim() !== "" && !items.some(item => item.name.toLowerCase() === inputValue.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {value
            ? items.find((item) => item.name.toLowerCase() === value.toLowerCase())?.name || value
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false} > 
          <CommandInput
            placeholder={searchPlaceholder}
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            {filteredItems.length === 0 && !showAddNewOption && (
                 <CommandEmpty>{emptyMessage}</CommandEmpty>
            )}
            {filteredItems.length > 0 && (
                <CommandGroup>
                {filteredItems.map((item) => (
                    <CommandItem
                    key={item.id}
                    value={item.name}
                    onSelect={handleSelect}
                    >
                    <Check
                        className={cn(
                        "mr-2 h-4 w-4",
                        (value ? value.toLowerCase() === item.name.toLowerCase() : false)
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                    />
                    {item.name}
                    </CommandItem>
                ))}
                </CommandGroup>
            )}
            {showAddNewOption && (
              <>
                {filteredItems.length > 0 && <CommandSeparator />}
                <CommandGroup>
                    <CommandItem
                        key="__add_new__"
                        value={`__add__${inputValue.trim()}`} // Unique value for selection
                        onSelect={handleAddNew}
                        disabled={isAdding}
                        className="text-primary aria-selected:text-primary"
                    >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        {isAdding ? `Adicionando "${inputValue.trim()}"...` : `Adicionar "${inputValue.trim()}"`}
                    </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
