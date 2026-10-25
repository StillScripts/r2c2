import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import type { ComponentProps, ReactNode } from "react"

type ConfirmButtonProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  title: string
  description: ReactNode
  confirmLabel: string
  onConfirm: () => void
}

/** A button that asks before it acts. */
export function ConfirmButton({
  title,
  description,
  confirmLabel,
  onConfirm,
  ...button
}: ConfirmButtonProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button {...button} />} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
