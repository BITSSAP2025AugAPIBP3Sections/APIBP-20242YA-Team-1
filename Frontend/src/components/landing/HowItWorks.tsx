import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { Mail, FolderOpen, BarChart3 } from "lucide-react";

const steps = [
  {
    icon: Mail,
    number: "01",
    title: "Connect Gmail",
    description: "Authorize your account securely in just a few clicks.",
  },
  {
    icon: FolderOpen,
    number: "02",
    title: "Invoices Auto-Organized",
    description: "Your invoices go to Drive folders instantly, sorted by vendor.",
  },
  {
    icon: BarChart3,
    number: "03",
    title: "Analyze & Query",
    description: "Extracted data in Sheets + chatbot answers questions in real-time.",
  },
];

export const HowItWorks = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { margin: "-100px" });

  return (
    <section ref={ref} className="py-24 md:py-32 bg-secondary/30">
      <div className="container px-4 md:px-8 mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            How it Works?
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Setting up your automated invoice management system is quick and effortless.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-12 max-w-5xl mx-auto">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className="relative text-center"
              >
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6 relative z-10">
                  <Icon className="w-10 h-10 text-primary" />
                </div>
                <div className="absolute top-10 left-1/2 -translate-x-1/2 text-8xl font-bold text-muted/10 -z-10">
                  {step.number}
                </div>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{step.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
