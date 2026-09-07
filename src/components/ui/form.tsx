import { createContext, useContext, useId, type ComponentProps, type ReactElement, cloneElement } from 'react'
import { Controller, FormProvider, useFormContext, type ControllerProps, type FieldPath, type FieldValues } from 'react-hook-form'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
const Form = FormProvider
const FieldContext = createContext<{ name: string } | null>(null)
const ItemContext = createContext<string | null>(null)
function FormField<T extends FieldValues, N extends FieldPath<T>>(props: ControllerProps<T, N>) {
 return <FieldContext.Provider value={{ name: props.name }}><Controller {...props}/></FieldContext.Provider>
}
function useFormField() {
 const field = useContext(FieldContext); const id = useContext(ItemContext); const form = useFormContext()
 if (!field || !id || !form) throw new Error('Form components require Form, FormField and FormItem')
 return { id, name: field.name, formItemId: id+'-control', formDescriptionId: id+'-description', formMessageId: id+'-message', ...form.getFieldState(field.name, form.formState) }
}
function FormItem({className,...props}: ComponentProps<'div'>) { const id=useId(); return <ItemContext.Provider value={id}><div className={cn('grid gap-2',className)} {...props}/></ItemContext.Provider> }
function FormLabel(props: ComponentProps<typeof Label>) { const field=useFormField(); return <Label htmlFor={field.formItemId} data-error={!!field.error} {...props}/> }
function FormControl({children}: {children: ReactElement<Record<string,unknown>>}) { const f=useFormField(); return cloneElement(children,{id:f.formItemId,'aria-describedby':f.formDescriptionId+(f.error?' '+f.formMessageId:''),'aria-invalid':!!f.error}) }
function FormDescription(props: ComponentProps<'p'>) { const f=useFormField(); return <p id={f.formDescriptionId} className="text-sm text-muted-foreground" {...props}/> }
function FormMessage({children,...props}: ComponentProps<'p'>) { const f=useFormField(); const message=f.error?.message?.toString()??children; return message ? <p id={f.formMessageId} role="alert" className="text-sm text-destructive" {...props}>{message}</p>:null }
export { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage, useFormField }
