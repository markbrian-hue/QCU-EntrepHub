using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace QCU.Backend.Models
{
    public class Order
    {
        [Key]
        public int OrderId { get; set; }
        public int CustomerId { get; set; }
        [ForeignKey("CustomerId")]
        public User? Customer { get; set; }

        public int VendorId { get; set; } // Tracks which shop this order belongs to

        public decimal TotalAmount { get; set; }
        public string Status { get; set; } = "PENDING";
        public string DeliveryMethod { get; set; } = "PICKUP";
        public string DeliveryLocation { get; set; } = string.Empty;
        public string PaymentMethod { get; set; } = "GCASH";
        public DateTime CreatedAt { get; set; }
    }
}