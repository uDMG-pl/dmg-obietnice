import * as React from "react"

import { cn } from "@/lib/utils"

const Form = React.forwardRef<HTMLFormElement, React.ComponentProps<"form">>(
  function Form({ className, ...props }, ref) {
    return (
      <form
        ref={ref}
        data-slot="form"
        className={cn(className)}
        {...props}
      />
    )
  },
)

export { Form }
