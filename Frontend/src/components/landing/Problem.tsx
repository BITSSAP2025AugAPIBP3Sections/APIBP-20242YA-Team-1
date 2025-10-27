import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { AlertCircle } from "lucide-react";

export const Problem = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { margin: "-100px" });

  const cards = [
    { title: "Information Overload", description: "Too many documents, difficult to manage and locate crucial details quickly." },
    { title: "Time-consuming and repetitive", description: "Spending hours each month on manual invoice processing that could be automated." },
    { title: "Hard to analyze", description: "Difficult to extract insights for budgeting and financial planning without structured data." }
  ];

  return (
    <section ref={ref} id="about" className="py-24 md:py-32 bg-secondary/30">
      <div className="container px-4 md:px-8 mx-auto">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
              <AlertCircle className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
              The Challenge We're Solving
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              Businesses receive hundreds of invoices each month via email. Manually downloading, organizing, and extracting data is challenging. Traditional solutions are either too complicated, too expensive.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {cards.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 40 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: index * 0.2, type: "spring", stiffness: 70, damping: 16 }}
                className="p-6 rounded-xl border border-border bg-card hover:shadow-md transition-shadow duration-300"
              >
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
