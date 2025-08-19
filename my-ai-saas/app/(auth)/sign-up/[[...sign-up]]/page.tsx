import { SignUp } from "@clerk/nextjs";

const SignUpPage = () => {
  return (
    <main className="flex justify-center items-center min-h-screen bg-black">
      <div className="w-full max-w-md">
        <SignUp 
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-neutral-900 border border-neutral-800 shadow-2xl",
              headerTitle: "text-white text-2xl font-bold",
              headerSubtitle: "text-neutral-400",
              socialButtonsBlockButton: "bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700",
              socialButtonsBlockButtonText: "text-white",
              dividerLine: "bg-neutral-700",
              dividerText: "text-neutral-400",
              formFieldLabel: "text-neutral-300",
              formFieldInput: "bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500 focus:border-white focus:ring-white",
              formButtonPrimary: "bg-white text-black hover:bg-neutral-200 font-medium",
              footerActionLink: "text-white hover:text-neutral-300",
              identityPreviewText: "text-neutral-300",
              identityPreviewEditButton: "text-white hover:text-neutral-300",
              formResendCodeLink: "text-white hover:text-neutral-300",
              otpCodeFieldInput: "bg-neutral-800 border-neutral-700 text-white",
              formFieldWarningText: "text-red-400",
              formFieldErrorText: "text-red-400",
              alertText: "text-red-400",
              formFieldHintText: "text-neutral-400",
              formFieldSuccessText: "text-green-400"
            },
            variables: {
              colorPrimary: "#ffffff",
              colorBackground: "#171717",
              colorInputBackground: "#262626",
              colorInputText: "#ffffff",
              colorText: "#ffffff",
              colorTextSecondary: "#a3a3a3",
              borderRadius: "0.5rem"
            }
          }}
        />
      </div>
    </main>
  );
};

export default SignUpPage;
