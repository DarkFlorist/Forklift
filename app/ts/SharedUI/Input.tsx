import { batch, Signal, useSignal, useSignalEffect } from '@preact/signals'
import { JSX } from 'preact/jsx-runtime'
import { OptionalSignal } from '../utils/OptionalSignal.js'
import { DetailedHTMLProps, InputHTMLAttributes } from 'preact/compat'

type MappedOmit<T, K extends keyof T> = { [P in keyof T as P extends K ? never : P]: T[P] } // https://github.com/microsoft/TypeScript/issues/54451
export interface BaseInputModel extends MappedOmit<DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>, 'value' | 'onInput'> {
	readonly rawValue?: Signal<string>
}

export interface UnparsedInputModel extends BaseInputModel {
	readonly value: Signal<string>
	readonly sanitize?: (input: string) => string
	readonly tryParse?: never
	readonly serialize?: never
	readonly invalidSignal?: Signal<boolean>
}

export interface ParsedInputModel<T> extends BaseInputModel {
	readonly value: OptionalSignal<T>
	readonly sanitize: (input: string) => string
	readonly tryParse: (input: string) => { ok: true, value: T | undefined } | { ok: false }
	readonly serialize: (input: T | undefined) => string
	readonly invalidSignal?: Signal<boolean>
}

function ParsedInput<T>(model: ParsedInputModel<T>) {
	const pendingOnChange = useSignal(false)
	const internalValue = model.rawValue || useSignal(model.serialize(model.value.deepPeek()))
	const isInvalid = useSignal(false)

	// internalValue changed or signal/hook referenced by sanitize/tryParse changed
	useSignalEffect(() => {
		batch(() => {
			const sanitized = model.sanitize(internalValue.value)
			internalValue.value = sanitized
			const parsed = model.tryParse(sanitized)

			const hasContent = sanitized.trim() !== ''
			isInvalid.value = hasContent && !parsed.ok

			if (!parsed.ok) {
				model.value.deepValue = undefined
				return
			}
			if (parsed.value !== model.value.deepPeek()) pendingOnChange.value = true
			model.value.deepValue = parsed.value
		})
	})

	// model value changed or signal/hook referenced by sanitize/tryParse/serialize changed
	useSignalEffect(() => {
		batch(() => {
			const sanitized = model.sanitize(internalValue.peek())
			const parsed = model.tryParse(sanitized)

			// If the input is invalid, don't change the visible input value
			if (!parsed.ok) return

			// Only update if the sanitized input doesn't match the serialized model value
			const currentSerialized = model.serialize(model.value.deepValue)
			if (sanitized === currentSerialized) return

			internalValue.value = currentSerialized
		})
	})

	function onChange(event: JSX.TargetedEvent<HTMLInputElement, Event>) {
		if (!pendingOnChange.peek()) return
		if (!model.onChange) return
		pendingOnChange.value = false
		model.onChange(event)
	}

	// we want to pass through all model values *except* the rawValue, which may contain a password
	const inputModel = { ...model }
	delete inputModel.rawValue

	// Expose invalid signal to the outside
	if ('invalidSignal' in model && model.invalidSignal instanceof Signal) {
		model.invalidSignal.value = isInvalid.value
	}

	const baseClass = model.class || ''
	const errorClass = isInvalid.value ? ' invalid' : ''
	inputModel.class = `${ baseClass }${ errorClass }`.trim()

	return <input { ...inputModel } value = { internalValue } onInput = { event => internalValue.value = event.currentTarget.value } onChange = { onChange }/>
}

export function Input<T>(model: UnparsedInputModel | ParsedInputModel<T>) {
	if ('tryParse' in model && model.tryParse !== undefined) {
		return <ParsedInput { ...model }/>
	} else {
		return <ParsedInput { ...model } value = { new OptionalSignal(model.value) } sanitize = { model.sanitize || (x => x) } tryParse = { value => ({ ok: true, value }) } serialize = { x => x || '' }/>
	}
}

// <>
// 	<Input value={new Signal('')}/>
// 	<Input value={new Signal('')} sanitize={x=>x}/>
// 	<Input value={new Signal('')} sanitize={x=>x} serialize={x=>x} tryParse={x=>({result:'success',value:x})}/>
// 	<Input/>
// 	<Input value={new Signal('')} sanitize={x=>x} serialize={(x: string)=>x}/>
// 	<Input value={new Signal('')} serialize={(x: string)=>x}/>
// </>
