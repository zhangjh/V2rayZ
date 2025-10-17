using System.ComponentModel.DataAnnotations;

namespace V2rayClient.Models;

/// <summary>
/// Validation attribute that makes a property required based on another property's value
/// </summary>
[AttributeUsage(AttributeTargets.Property, AllowMultiple = false)]
public class RequiredIfAttribute : ValidationAttribute
{
    private readonly string _dependentProperty;
    private readonly object _targetValue;

    /// <summary>
    /// Creates a new RequiredIf validation attribute
    /// </summary>
    /// <param name="dependentProperty">The name of the property to check</param>
    /// <param name="targetValue">The value that makes this property required</param>
    public RequiredIfAttribute(string dependentProperty, object targetValue)
    {
        _dependentProperty = dependentProperty;
        _targetValue = targetValue;
    }

    protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
    {
        // Get the dependent property
        var dependentProperty = validationContext.ObjectType.GetProperty(_dependentProperty);
        
        if (dependentProperty == null)
        {
            return new ValidationResult($"Unknown property: {_dependentProperty}");
        }

        // Get the value of the dependent property
        var dependentValue = dependentProperty.GetValue(validationContext.ObjectInstance);

        // Check if the dependent property has the target value
        if (dependentValue != null && dependentValue.Equals(_targetValue))
        {
            // If it does, this property is required
            if (value == null || (value is string str && string.IsNullOrWhiteSpace(str)))
            {
                return new ValidationResult(
                    ErrorMessage ?? $"{validationContext.DisplayName} is required when {_dependentProperty} is {_targetValue}",
                    new[] { validationContext.MemberName ?? string.Empty }
                );
            }
        }

        return ValidationResult.Success;
    }
}
